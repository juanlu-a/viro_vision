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
  generarConImagen,
  generarTexto,
  sondearRuntime,
} from '@/services/ondevice';
import type { CargaResultado, GeneracionResultado, ResultadoSonda } from '@/services/ondevice';
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
    // Sin copiar a la caché: el archivo pesa 2,59 GB y duplicarlo llenaría el teléfono para nada.
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
    if (r.canceled || !r.assets?.[0]) return;
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
    update({ estado: 'loading', mensaje: t.loading, carga: null });
    try {
      const carga = await cargarModelo(decodeURI(archivo.uri.replace('file://', '')), backend, multimodal);
      update({ estado: 'idle', carga, mensaje: t.loaded });
    } catch (err) {
      update({ estado: 'idle', mensaje: `${t.error}: ${describir(err)}` });
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
      update({ estado: 'idle', mensaje: `${t.error}: ${describir(err)}` });
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
      update({ estado: 'idle', mensaje: `${t.error}: ${describir(err)}` });
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
