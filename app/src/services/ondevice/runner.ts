/**
 * Carga un modelo local y lo mide. El paso 2 y 3 del spike del ADR 0004.
 *
 * REGLA DE FRONTERA (ADR 0001, nota 2026-08-10): instrumentación de desarrollo. Nada de
 * `features/recognition/` ni `features/audio/` puede importarlo — el linter lo fuerza.
 *
 * **El modelo se elige con el selector de archivos, no se embebe ni se descarga.** Es a propósito
 * para el spike: embeberlo metería 2,59 GB en cada build y no cambiaría el riesgo real (el archivo
 * se mapea igual en memoria), y descargarlo son 2,59 GB por cada vez que queramos probar otro. Con
 * el selector se cambia de modelo sin recompilar, que es justo lo que hace falta para probar
 * primero el chico y después el grande. En producción el modelo **sí** se descarga la primera vez
 * que se usa, como dice el ADR 0004.
 *
 * Los tiempos se toman con `performance.now()` acá, no con `Date.now()`: son duraciones medidas.
 * La librería además reporta sus propias métricas nativas (`timeToFirstToken`, `tokensPerSecond`),
 * y se guardan las dos — si difieren mucho, el overhead está en el puente JS y eso también es un
 * dato.
 */
import { createLLM } from 'react-native-litert-lm';
import type { Backend, GenerationStats, LiteRTLMInstance } from 'react-native-litert-lm';

import { MAX_CONTEXT_TOKENS } from './config';

export interface CargaResultado {
  /** Milisegundos hasta que `loadModel` resolvió. La métrica que el ADR 0004 pedía y nadie midió. */
  cargaMs: number;
  /** Memoria del proceso después de cargar, para contrastar con la estimación previa. */
  memoriaDespuesBytes: number | null;
  backend: Backend;
}

export interface GeneracionResultado {
  texto: string;
  /** Medido desde JS: incluye el ida y vuelta por el puente. */
  totalMs: number;
  /** Lo que reporta la librería desde el runtime nativo. `null` si no las expuso. */
  stats: GenerationStats | null;
}

/**
 * Instancia viva. Se guarda a nivel de módulo a propósito: cargar el modelo son segundos y varios
 * GB, así que re-crearlo por cada medición haría imposible distinguir carga en frío de carga en
 * caliente — que es justamente una de las cosas a medir.
 */
let instancia: LiteRTLMInstance | null = null;

export function modeloCargado(): boolean {
  return instancia !== null;
}

/**
 * Carga un `.litertlm` desde una ruta del sistema de archivos.
 *
 * `multimodal` va explícito y no por olfateo del nombre del archivo: la librería adivina por
 * nombre ("3n"/"gemma3") y con un archivo renombrado o con Gemma 4 esa heurística se equivoca.
 */
export async function cargarModelo(
  rutaArchivo: string,
  backend: Backend,
  multimodal: boolean,
): Promise<CargaResultado> {
  await descargarModelo();

  const llm = createLLM();
  const t0 = performance.now();
  await llm.loadModel(rutaArchivo, {
    backend,
    maxContextTokens: MAX_CONTEXT_TOKENS,
    multimodal,
  });
  const cargaMs = performance.now() - t0;

  instancia = llm;

  let memoriaDespuesBytes: number | null = null;
  try {
    memoriaDespuesBytes = llm.getMemoryUsage().residentBytes;
  } catch {
    // Que falle la lectura de memoria no invalida la carga, que es lo que se estaba midiendo.
  }

  return { cargaMs, memoriaDespuesBytes, backend };
}

/** Genera con una imagen. Sólo tiene sentido con un modelo multimodal (Gemma 4, no Gemma 3 1B). */
export async function generarConImagen(
  prompt: string,
  rutaImagen: string,
): Promise<GeneracionResultado> {
  return medir((llm) => llm.sendMessageWithImage(prompt, rutaImagen));
}

/** Genera sólo con texto. Sirve para probar que el runtime anda con un modelo chico. */
export async function generarTexto(prompt: string): Promise<GeneracionResultado> {
  return medir((llm) => llm.sendMessage(prompt));
}

async function medir(
  fn: (llm: LiteRTLMInstance) => Promise<string>,
): Promise<GeneracionResultado> {
  const llm = instancia;
  if (!llm) throw new Error('No hay modelo cargado.');

  const t0 = performance.now();
  const texto = await fn(llm);
  const totalMs = performance.now() - t0;

  let stats: GenerationStats | null = null;
  try {
    stats = llm.getStats();
  } catch {
    stats = null;
  }

  return { texto, totalMs, stats };
}

/**
 * Libera el modelo. Importante entre pruebas: dejar 2,59 GB mapeados mientras se carga otro modelo
 * es la forma más rápida de que iOS mate la app y de culpar al modelo equivocado.
 */
export async function descargarModelo(): Promise<void> {
  if (!instancia) return;
  try {
    await instancia.unload();
  } catch {
    // Si no se pudo liberar limpio, igual se suelta la referencia: insistir no ayuda.
  }
  instancia = null;
}
