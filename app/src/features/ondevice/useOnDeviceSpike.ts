/**
 * Máquina de estados del spike de inferencia local (ADR 0004).
 *
 * REGLA DE FRONTERA (ADR 0001): instrumentación de desarrollo, prohibida en el camino de
 * reconocimiento. El linter lo fuerza.
 *
 * El modelo se elige con el selector de **archivos** a propósito: el spike prueba dos modelos
 * distintos —uno chico de sólo texto y uno grande multimodal— y con el selector se cambia entre
 * ellos sin recompilar ni volver a bajar gigabytes. El selector de *modelo* con descarga bajo
 * demanda es el camino del producto, no el del experimento.
 *
 * El prompt y el parser son **los mismos** que usa el benchmark de nube. Es la única forma de que
 * los dos números signifiquen lo mismo: misma foto, mismo prompt, mismo parser.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { strings } from '@/i18n';
import {
  adoptarModelo,
  cargarModelo,
  CONTEXTOS,
  descargarModelo,
  descargarModeloRemoto,
  diagnosticar,
  espacioLibre,
  limpiarCopias,
  MAX_CONTEXT_TOKENS,
  MODELOS_REMOTOS,
  tamanoModelosGuardados,
  generarConImagen,
  generarTexto,
  sondearRuntime,
} from '@/services/ondevice';
import type {
  CargaResultado,
  ModeloRemoto,
  Diagnostico,
  GeneracionResultado,
  ResultadoSonda,
} from '@/services/ondevice';
import { busReadingSchema, formatBytes, parseBusReading } from '@/services/vision';
import type { BusReading } from '@/services/vision';
import { SYSTEM_PROMPT, USER_PROMPT } from '@/services/vision/providers';

const t = strings.ondevice;

type Backend = 'cpu' | 'gpu';

export interface SpikeState {
  estado: 'idle' | 'probing' | 'loading' | 'running';
  mensaje: string;
  sonda: ResultadoSonda | null;
  archivo: { uri: string; nombre: string } | null;
  backend: Backend;
  multimodal: boolean;
  precision: 'f32' | 'f16';
  contexto: number;
  /** Cuál de los modelos del catálogo está seleccionado para descargar. */
  remoto: ModeloRemoto;
  /** Fracción 0–1 mientras se descarga, `null` si no hay descarga en curso. */
  progreso: number | null;
  /** Cuánto tardó la última descarga. Es costo de onboarding, no latencia. */
  descargaMs: number | null;
  carga: CargaResultado | null;
  /** Se calcula al intentar cargar y sobrevive al fallo: es cuando más hace falta. */
  diagnostico: Diagnostico | null;
  generacion: GeneracionResultado | null;
  lectura: BusReading | null;
}

const inicial: SpikeState = {
  estado: 'idle',
  mensaje: t.idle,
  sonda: null,
  archivo: null,
  backend: 'cpu',
  multimodal: false,
  precision: 'f16',
  contexto: MAX_CONTEXT_TOKENS,
  remoto: MODELOS_REMOTOS[1],
  progreso: null,
  descargaMs: null,
  carga: null,
  diagnostico: null,
  generacion: null,
  lectura: null,
};

export function useOnDeviceSpike() {
  const [state, setState] = useState<SpikeState>(inicial);
  const ref = useRef(inicial);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      // Salir de la pantalla con varios GB mapeados es la forma más rápida de que iOS mate la app
      // y de culpar al modelo equivocado en la próxima prueba.
      void descargarModelo();
    };
  }, []);

  const update = useCallback((patch: Partial<SpikeState>) => {
    ref.current = { ...ref.current, ...patch };
    if (vivo.current) setState(ref.current);
  }, []);

  const sondear = useCallback(async () => {
    update({ estado: 'probing', mensaje: t.probing });
    const sonda = await sondearRuntime();
    update({
      estado: 'idle',
      sonda,
      mensaje: sonda.error ? `${t.error}: ${sonda.error}` : t.nativeOk,
    });
  }, [update]);

  const elegirArchivo = useCallback(async () => {
    // **Hay que copiarlo, aunque duela.** LiteRT-LM escribe su caché compilada en la carpeta del
    // propio modelo (`cacheDir = parent(modelPath)`, en HybridLiteRTLM.swift). Un archivo elegido
    // de otra app se puede leer pero no escribir al lado, así que el motor se crea y después falla
    // al armar la conversación, con un error que no menciona permisos por ningún lado.
    // El precio es una copia: 584 MB para el Gemma 3 1B, 2,59 GB para el Gemma 4 E2B.
    update({ mensaje: t.copying });
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) {
      update({ mensaje: ref.current.archivo?.nombre ?? t.noModelPicked });
      return;
    }
    const a = r.assets[0];
    // La copia del selector se **muda** a la carpeta de modelos, borrando cualquier modelo previo.
    // Sin esto quedaba una copia nueva por cada elección: así la app llegó a ~10 GB.
    update({ mensaje: t.copying });
    let adoptado: { ruta: string; nombre: string };
    try {
      adoptado = await adoptarModelo(a.uri);
    } catch (err) {
      update({ mensaje: `${t.loadError}: ${describir(err)}` });
      return;
    }
    // Heurística sólo como valor inicial: el usuario puede corregirla con el interruptor. Los
    // modelos "1b"/"3-1b" son de sólo texto y activar multimodal con ellos falla al cargar.
    const pareceMultimodal = /e2b|e4b|gemma-?4/i.test(a.name);
    // El diagnóstico se calcula **acá**, no al cargar: cargar puede abortar el proceso —XNNPack
    // hace `abort()` si no puede escribir su caché de pesos— y un aborto nativo le gana de mano al
    // render. Calculado al elegir, los números están en pantalla *antes* de arriesgar la carga.
    update({
      archivo: { uri: adoptado.ruta, nombre: adoptado.nombre },
      multimodal: pareceMultimodal,
      carga: null,
      diagnostico: diagnosticar(adoptado.ruta, ref.current.backend, ref.current.contexto),
      generacion: null,
      lectura: null,
      mensaje: `${adoptado.nombre} · ${t.stored} ${formatBytes(tamanoModelosGuardados())}`,
    });
  }, [update]);

  /** Rota entre los modelos del catálogo, del más chico al más grande. */
  const rotarRemoto = useCallback(() => {
    const i = MODELOS_REMOTOS.indexOf(ref.current.remoto);
    update({ remoto: MODELOS_REMOTOS[(i + 1) % MODELOS_REMOTOS.length] });
  }, [update]);

  const descargar = useCallback(async () => {
    const { remoto } = ref.current;
    update({ estado: 'loading', mensaje: t.downloading, progreso: 0, carga: null });
    try {
      const r = await descargarModeloRemoto(remoto.url, (fraccion) =>
        // Sólo se re-renderiza el progreso: el resto del estado no cambia durante la descarga.
        update({ progreso: fraccion }),
      );
      update({
        estado: 'idle',
        progreso: null,
        descargaMs: r.ms,
        archivo: { uri: r.ruta, nombre: r.nombre },
        multimodal: remoto.multimodal,
        diagnostico: diagnosticar(r.ruta, ref.current.backend, ref.current.contexto),
        mensaje: `${r.nombre} · ${t.stored} ${formatBytes(tamanoModelosGuardados())}`,
      });
    } catch (err) {
      update({ estado: 'idle', progreso: null, mensaje: `${t.downloadError}: ${describir(err)}` });
    }
  }, [update]);

  const setBackend = useCallback(
    (backend: Backend) => {
      const archivo = ref.current.archivo;
      update({
        backend,
        carga: null,
        generacion: null,
        lectura: null,
        // La estimación de memoria depende del backend: recalcularla o mostraría la del anterior.
        diagnostico: archivo ? diagnosticar(archivo.uri, backend, ref.current.contexto) : null,
      });
    },
    [update],
  );

  const setMultimodal = useCallback(
    (multimodal: boolean) => update({ multimodal, carga: null }),
    [update],
  );

  const setPrecision = useCallback(
    (precision: 'f32' | 'f16') => update({ precision, carga: null }),
    [update],
  );

  /** Rota entre los presupuestos de contexto. Bajarlo es la palanca más barata contra la memoria. */
  const rotarContexto = useCallback(() => {
    const { archivo, backend, contexto } = ref.current;
    const siguiente = CONTEXTOS[(CONTEXTOS.indexOf(contexto as never) + 1) % CONTEXTOS.length];
    update({
      contexto: siguiente,
      carga: null,
      diagnostico: archivo ? diagnosticar(archivo.uri, backend, siguiente) : null,
    });
  }, [update]);

  const cargar = useCallback(async () => {
    const { archivo, backend, multimodal, precision, contexto } = ref.current;
    if (!archivo) return;
    update({ estado: 'loading', mensaje: t.loading, carga: null });
    try {
      const carga = await cargarModelo(archivo.uri, backend, multimodal, precision, contexto);
      update({ estado: 'idle', carga, mensaje: t.loaded });
    } catch (err) {
      update({ estado: 'idle', mensaje: `${t.loadError}: ${describir(err)}` });
    }
  }, [update]);

  const limpiar = useCallback(async () => {
    update({ estado: 'loading', mensaje: t.cleaning });
    const bytes = await limpiarCopias();
    const libre = espacioLibre();
    update({
      estado: 'idle',
      archivo: null,
      carga: null,
      diagnostico: null,
      generacion: null,
      lectura: null,
      mensaje: `${t.cleaned} ${formatBytes(bytes)}. ${t.diskFree}: ${formatBytes(libre ?? 0)}.`,
    });
  }, [update]);

  const liberar = useCallback(async () => {
    await descargarModelo();
    update({ carga: null, generacion: null, lectura: null, mensaje: t.idle });
  }, [update]);

  const probarTexto = useCallback(async () => {
    update({ estado: 'running', mensaje: t.running, generacion: null, lectura: null });
    try {
      const g = await generarTexto('Respondé solo con la palabra: listo.');
      update({ estado: 'idle', generacion: g, mensaje: t.result });
    } catch (err) {
      update({ estado: 'idle', mensaje: `${t.runError}: ${describir(err)}` });
    }
  }, [update]);

  const probarImagen = useCallback(async () => {
    const foto = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (foto.canceled || !foto.assets?.[0]) return;

    update({ estado: 'running', mensaje: t.running, generacion: null, lectura: null });
    try {
      // Mismo prompt que la nube: si el prompt difiere, los dos números dejan de ser comparables.
      const g = await generarConImagen(
        `${SYSTEM_PROMPT}\n\n${USER_PROMPT}`,
        decodeURI(foto.assets[0].uri.replace('file://', '')),
        // El mismo schema que le exige la nube: misma forma de salida, mismo parser.
        busReadingSchema,
      );
      update({
        estado: 'idle',
        generacion: g,
        lectura: parseBusReading(g.texto),
        mensaje: t.result,
      });
    } catch (err) {
      update({ estado: 'idle', mensaje: `${t.runError}: ${describir(err)}` });
    }
  }, [update]);

  return {
    state,
    sondear,
    elegirArchivo,
    rotarRemoto,
    descargar,
    setBackend,
    setMultimodal,
    setPrecision,
    rotarContexto,
    cargar,
    liberar,
    limpiar,
    probarTexto,
    probarImagen,
  };
}

function describir(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
