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
import { Directory, File, Paths } from 'expo-file-system';
import { createLLM, estimateMemory } from 'react-native-litert-lm';
import type { Backend, GenerationStats, LiteRTLMInstance } from 'react-native-litert-lm';

import { MAX_CONTEXT_TOKENS } from './config';

/**
 * Lo que se sabe **antes** de intentar cargar. Existe porque cuando la carga falla, el error de la
 * librería no dice cuál de las causas posibles fue: "Failed to create conversation context" es el
 * mismo mensaje para una copia truncada que para falta de memoria. Con estos tres números el
 * diagnóstico se lee en pantalla en vez de adivinarse.
 */
export interface Diagnostico {
  /** Tamaño real del archivo copiado. Si no coincide con el original, la copia se truncó. */
  archivoBytes: number | null;
  /** Espacio libre en el disco del teléfono. */
  discoLibreBytes: number | null;
  /** Memoria que el sistema dice tener disponible ahora. */
  memoriaDisponibleBytes: number | null;
  /** Veredicto de la estimación para **este** archivo y **este** backend. */
  veredicto: string | null;
  detalle: string | null;
}

export interface CargaResultado {
  /** Milisegundos hasta que `loadModel` resolvió. La métrica que el ADR 0004 pedía y nadie midió. */
  cargaMs: number;
  /** Memoria del proceso después de cargar, para contrastar con la estimación previa. */
  memoriaDespuesBytes: number | null;
  backend: Backend;
}

/** Se calcula antes de cargar y **también se devuelve si la carga falla**, que es cuando importa. */
export function diagnosticar(rutaArchivo: string, backend: Backend): Diagnostico {
  const base: Diagnostico = {
    archivoBytes: null,
    discoLibreBytes: null,
    memoriaDisponibleBytes: null,
    veredicto: null,
    detalle: null,
  };

  try {
    base.archivoBytes = new File(rutaArchivo).size ?? null;
  } catch {
    // Un archivo ilegible ya es un diagnóstico: se reporta como null y sigue.
  }
  try {
    base.discoLibreBytes = Paths.availableDiskSpace;
  } catch {
    /* dato accesorio */
  }

  try {
    const disponible = createLLM().getMemoryUsage().availableMemoryBytes;
    base.memoriaDisponibleBytes = disponible;
    if (base.archivoBytes) {
      const e = estimateMemory({
        modelFileSizeBytes: base.archivoBytes,
        availableMemoryBytes: disponible,
        config: { backend, maxContextTokens: MAX_CONTEXT_TOKENS },
      });
      base.veredicto = e.verdict;
      base.detalle = e.recommendation;
    }
  } catch {
    /* si el nativo no responde, el resto del diagnóstico igual sirve */
  }

  return base;
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
  // `skipMemoryCheck` no se toca: la comprobación previa de la librería es justamente la que
  // convierte un cierre por falta de memoria —que no deja rastro— en un error que se puede leer.
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

/**
 * Borra las copias de modelos que dejó el selector de archivos, y devuelve cuántos bytes liberó.
 *
 * Hace falta porque el precio de copiar es acumulativo y silencioso: cada vez que se elige un
 * archivo queda otra copia de varios GB en la caché de la app. Cuando el disco se llena, el
 * síntoma **no** dice "disco lleno": XNNPack no puede escribir su caché de pesos y llama a
 * `abort()`, así que la app se cierra sin mensaje — y falla incluso con un modelo chico que antes
 * andaba, lo que hace parecer que se rompió el código.
 */
export async function limpiarCopias(): Promise<number> {
  // Hay que soltar el modelo antes de borrar el archivo que está mapeado.
  await descargarModelo();

  let liberados = limpiarCarpetaCache('DocumentPicker') + limpiarCarpetaCache('ImagePicker');

  try {
    const dir = carpetaModelos();
    for (const entrada of dir.list()) {
      if (entrada instanceof File) liberados += entrada.size ?? 0;
      entrada.delete();
    }
  } catch {
    // Idem: se informa lo que sí se pudo liberar.
  }

  return liberados;
}

/** Espacio libre en disco, para mostrarlo antes de copiar varios GB. */
export function espacioLibre(): number | null {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}

/**
 * Carpeta donde vive **el** modelo. Singular a propósito: guarda uno solo.
 *
 * Va en `document` y no en `cache` porque iOS puede vaciar la caché cuando le hace falta espacio, y
 * hacerlo con un archivo de 2,59 GB mapeado a mitad de una inferencia sería peor que cualquier
 * ahorro. Además es la carpeta donde la app puede escribir, que es lo que LiteRT-LM necesita para
 * su caché compilada.
 */
function carpetaModelos(): Directory {
  const dir = new Directory(Paths.document, 'modelos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Deja el archivo elegido como **único** modelo guardado y devuelve su ruta.
 *
 * El selector deposita su copia en la caché. Acá se borra cualquier modelo anterior y se **mueve**
 * la copia nueva a la carpeta definitiva: mover es renombrar dentro del mismo contenedor, así que
 * no cuesta espacio adicional.
 *
 * Existe porque la versión anterior dejaba una copia nueva por cada vez que se elegía un archivo,
 * sin borrar las viejas. Con modelos de 2,59 GB eso llevó la app a ~10 GB y terminó llenando el
 * disco del teléfono — y el disco lleno se manifiesta como un cierre sin mensaje, no como un error.
 */
export async function adoptarModelo(uriCopiado: string): Promise<{ ruta: string; nombre: string }> {
  await descargarModelo();

  const destino = carpetaModelos();
  for (const previo of destino.list()) previo.delete();

  const origen = new File(uriCopiado);
  const nombre = origen.name;
  await origen.move(destino);

  // La carpeta del selector puede quedar con restos de intentos anteriores.
  limpiarCarpetaCache('DocumentPicker');

  return { ruta: `${destino.uri.replace('file://', '')}/${nombre}`, nombre };
}

/** Cuánto ocupan hoy los modelos guardados. Para que el costo esté a la vista y no sorprenda. */
export function tamanoModelosGuardados(): number {
  try {
    return carpetaModelos()
      .list()
      .reduce((total, e) => total + (e instanceof File ? (e.size ?? 0) : 0), 0);
  } catch {
    return 0;
  }
}

function limpiarCarpetaCache(nombre: string): number {
  let liberados = 0;
  try {
    const dir = new Directory(Paths.cache, nombre);
    if (!dir.exists) return 0;
    for (const entrada of dir.list()) {
      if (entrada instanceof File) liberados += entrada.size ?? 0;
      entrada.delete();
    }
  } catch {
    // Que una carpeta no se pueda borrar no impide intentar con las otras.
  }
  return liberados;
}
