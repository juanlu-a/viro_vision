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
  cargarModelo,
  descargarModelo,
  diagnosticar,
  generarConImagen,
  generarTexto,
  sondearRuntime,
} from '@/services/ondevice';
import type {
  CargaResultado,
  Diagnostico,
  GeneracionResultado,
  ResultadoSonda,
} from '@/services/ondevice';
import { parseBusReading } from '@/services/vision';
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
    // Heurística sólo como valor inicial: el usuario puede corregirla con el interruptor. Los
    // modelos "1b"/"3-1b" son de sólo texto y activar multimodal con ellos falla al cargar.
    const pareceMultimodal = /e2b|e4b|gemma-?4/i.test(a.name);
    update({
      archivo: { uri: a.uri, nombre: a.name },
      multimodal: pareceMultimodal,
      carga: null,
      generacion: null,
      lectura: null,
      mensaje: a.name,
    });
  }, [update]);

  const setBackend = useCallback(
    (backend: Backend) => update({ backend, carga: null, generacion: null, lectura: null }),
    [update],
  );

  const setMultimodal = useCallback(
    (multimodal: boolean) => update({ multimodal, carga: null }),
    [update],
  );

  const cargar = useCallback(async () => {
    const { archivo, backend, multimodal } = ref.current;
    if (!archivo) return;
    const ruta = decodeURI(archivo.uri.replace('file://', ''));
    // El diagnóstico se toma ANTES de cargar y se guarda pase lo que pase: si la carga falla, el
    // mensaje de la librería es el mismo para una copia truncada que para falta de memoria.
    update({ estado: 'loading', mensaje: t.loading, carga: null, diagnostico: diagnosticar(ruta, backend) });
    try {
      const carga = await cargarModelo(ruta, backend, multimodal);
      update({ estado: 'idle', carga, mensaje: t.loaded });
    } catch (err) {
      update({ estado: 'idle', mensaje: `${t.loadError}: ${describir(err)}` });
    }
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
    setBackend,
    setMultimodal,
    cargar,
    liberar,
    probarTexto,
    probarImagen,
  };
}

function describir(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
