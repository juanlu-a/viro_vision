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

import { MAX_CONTEXT_TOKENS, MAX_OUTPUT_TOKENS } from './config';

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
export function diagnosticar(
  rutaArchivo: string,
  backend: Backend,
  contexto: number = MAX_CONTEXT_TOKENS,
): Diagnostico {
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
        config: { backend, maxContextTokens: contexto },
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
  /** Hasta el primer token **con contenido**. `null` si el runtime no emitió ninguno. */
  ttftMs: number | null;
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
  precision: 'f32' | 'f16' = 'f16',
  maxContextTokens: number = MAX_CONTEXT_TOKENS,
  structuredOutput: boolean = true,
): Promise<CargaResultado> {
  await descargarModelo();

  const llm = createLLM();
  // `skipMemoryCheck` no se toca: la comprobación previa de la librería es justamente la que
  // convierte un cierre por falta de memoria —que no deja rastro— en un error que se puede leer.
  const t0 = performance.now();
  await llm.loadModel(rutaArchivo, {
    backend,
    maxContextTokens,
    // La respuesta son dos campos cortos: reservar más salida sería KV cache tirado.
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    multimodal,
    // `f16` reduce a la mitad la memoria de activaciones, y es lo que recomienda el propio
    // estimador de la librería cuando el veredicto da "tight". Es una opción **sólo de iOS**, que
    // es la plataforma donde el modelo grande no entraba; en Android el SDK no la expone.
    activationDataType: precision,
    // Habilita el decodificado restringido, que es lo que permite exigir el JSON por schema en
    // vez de pedirlo por prompt y rezar. Es configurable porque **se inicializa justo donde falla
    // la carga** —al crear la conversación—, así que hay que poder descartarlo como causa antes
    // de culpar al codificador de visión.
    enableStructuredOutput: structuredOutput,
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

/**
 * Genera a partir de una imagen, **exigiendo** la forma de la respuesta por schema.
 *
 * Usa `execute` con partes multimodales en vez de `sendMessageWithImage` por una razón concreta:
 * es la única variante que acepta `responseSchema`, y con eso el runtime **garantiza** que la
 * salida parsea contra el schema en lugar de pedirlo por prompt y confiar. El benchmark de nube
 * usa salida estructurada del mismo modo, así que además mantiene la comparación honesta: si uno
 * tuviera la forma garantizada y el otro no, la diferencia de precisión no sería del modelo.
 *
 * El orden —imagen primero, texto después— es el mismo que usa el proveedor de nube.
 */
export async function generarConImagen(
  prompt: string,
  rutaImagen: string,
  schema: object | null,
): Promise<GeneracionResultado> {
  return medir((llm, onToken) =>
    llm.execute(
      [
        { type: 'image', path: rutaImagen },
        { type: 'text', text: prompt },
      ],
      onToken,
      // Sin `enableStructuredOutput` al cargar, exigir el schema acá daría error: se pide por
      // prompt y se valida con el parser, como hace cualquier cliente sin salida garantizada.
      schema ? { responseSchema: JSON.stringify(schema) } : undefined,
    ),
  );
}

/** Genera sólo con texto. Sirve para probar que el runtime anda con un modelo chico. */
export async function generarTexto(prompt: string): Promise<GeneracionResultado> {
  return medir((llm, onToken) => llm.sendMessageAsync(prompt, onToken));
}

/**
 * Mide una generación **en streaming**, y no con la variante que devuelve todo junto.
 *
 * No es un detalle: con la versión no-streaming, "el primer token" llega cuando la respuesta ya
 * terminó, así que el time-to-first-token da ~1 ms y no significa nada. El benchmark de nube mide
 * el TTFT sobre el primer delta de texto del stream; si acá se midiera de otra forma, los dos
 * números dejarían de ser comparables — que es justamente lo que este spike existe para permitir.
 */
async function medir(
  fn: (
    llm: LiteRTLMInstance,
    onToken: (token: string, done: boolean) => void,
  ) => Promise<unknown>,
): Promise<GeneracionResultado> {
  const llm = instancia;
  if (!llm) throw new Error('No hay modelo cargado.');

  let texto = '';
  let primerTokenMs: number | null = null;

  const t0 = performance.now();
  await fn(llm, (token, done) => {
    // El primer token con contenido, no el primer callback: algunos runtimes emiten uno vacío.
    if (primerTokenMs === null && token.length > 0) primerTokenMs = performance.now() - t0;
    if (!done) texto += token;
  });
  const totalMs = performance.now() - t0;

  let stats: GenerationStats | null = null;
  try {
    stats = llm.getStats();
  } catch {
    stats = null;
  }

  return { texto, totalMs, ttftMs: primerTokenMs, stats };
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

/**
 * Descarga el modelo multimodal directamente a la carpeta de la app.
 *
 * Es el camino que el ADR 0004 define para el producto —el modelo se baja la primera vez que se
 * usa— y acá además resuelve dos problemas del spike: garantiza la **variante correcta** (el
 * `gemma-4-E2B-it.litertlm` sin sufijo; las `-gpu` y `-web` no traen codificador de visión y no
 * pueden leer un cartel), y mide cuánto tarda, que es un costo de onboarding real y todavía no
 * medido por nadie.
 *
 * Descarga al destino final, no a una carpeta temporal: no hay espacio para dos copias de 2,59 GB.
 */
export async function descargarModeloRemoto(
  url: string,
  onProgress: (fraccion: number, bytes: number, total: number) => void,
): Promise<{ ruta: string; nombre: string; ms: number }> {
  await descargarModelo();

  const destino = carpetaModelos();
  // Un modelo a la vez: lo viejo se va antes de traer lo nuevo, o no entra.
  for (const previo of destino.list()) previo.delete();

  const t0 = performance.now();
  const archivo = await File.downloadFileAsync(url, destino, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress(totalBytes > 0 ? bytesWritten / totalBytes : 0, bytesWritten, totalBytes);
    },
  });
  const ms = performance.now() - t0;

  return { ruta: archivo.uri.replace('file://', ''), nombre: archivo.name, ms };
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
