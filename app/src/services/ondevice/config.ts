/**
 * Catálogo de modelos locales medibles.
 *
 * REGLA DE FRONTERA (ADR 0001, nota 2026-08-10): esto es instrumentación de desarrollo, igual que
 * `services/vision/`. Mide un runtime local para decidir si sirve; **no** es todavía el camino de
 * reconocimiento. Nada de `features/recognition/` ni de `features/audio/` puede importar este
 * módulo — la regla está además forzada por `no-restricted-imports` en `eslint.config.js`.
 *
 * Por qué Gemma 4 E2B y no el 3n que nombra el ADR 0004: el 3n es **más grande** (3,66 GB contra
 * 2,59 GB) *y* está gated con aprobación manual en Hugging Face, así que el descargador de la
 * librería no puede traerlo sin token. Gemma 4 E2B es apache-2.0 y abierto.
 */

/** Tamaño exacto del archivo, verificado contra la API de Hugging Face. */
export const GEMMA_4_E2B_BYTES = 2_588_147_712;

export const GEMMA_4_E2B_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm';

/**
 * Las dos configuraciones que hay que probar, en este orden.
 *
 * Google publica huellas medidas en iPhone: ~607 MB en CPU y ~1450 MB en GPU. Se prueba primero la
 * chica —la que más chances tiene de sobrevivir— y después la rápida, que es la que da los 0,3 s de
 * time-to-first-token. Si las dos mueren, el veredicto es que hace falta el entitlement de
 * direccionamiento virtual extendido, y eso es una pregunta de presupuesto, no técnica.
 */
export const CONFIGURACIONES = [
  { backend: 'cpu', label: 'CPU (~607 MB)' },
  { backend: 'gpu', label: 'GPU (~1450 MB)' },
] as const;

/**
 * Presupuestos de contexto para probar, del más holgado al más apretado.
 *
 * El KV cache es el único término de memoria que controlamos desde JS, y crece linealmente con el
 * contexto. La tarea no necesita casi nada: dos frases de prompt, una imagen, y una respuesta de
 * dos campos cortos. Bajarlo es la palanca más barata para hacerle lugar al codificador de visión,
 * que es lo que no entra.
 *
 * 512 es el default: por debajo, una imagen puede no entrar en el contexto —ocupa varios cientos
 * de tokens al codificarse— y el fallo se confundiría con el de memoria.
 */
export const CONTEXTOS = [1024, 512, 256] as const;

export const MAX_CONTEXT_TOKENS = 512;

/**
 * Techo de salida. La respuesta son dos campos cortos, así que pedir más sólo reserva KV cache que
 * no se va a usar.
 */
export const MAX_OUTPUT_TOKENS = 64;

/**
 * ¿Se muestra la pantalla del spike?
 *
 * Se gatea por variable de entorno y **no por `__DEV__`**: el spike hay que medirlo en un build de
 * Release corriendo en el teléfono sin la laptop cerca, que es donde `__DEV__` vale `false`. Mismo
 * criterio que el benchmark de nube, que se gatea por la presencia de la clave.
 */
export const isOnDeviceSpikeEnabled = (process.env.EXPO_PUBLIC_ONDEVICE_SPIKE ?? '') !== '';

/**
 * Modelos con entrada de imagen que se pueden bajar desde la app, del más chico al más grande.
 *
 * Por qué hay varios y no sólo Gemma: el ADR 0004 eligió **el runtime** (LiteRT-LM) y "la variante
 * más chica primero". Gemma 4 E2B es el más chico de la familia Gemma que lee imágenes, y en un
 * iPhone 15 Pro no logra crear la conversación con el codificador de visión activo. Estos otros
 * corren en el mismo runtime y pesan la mitad o menos, así que probarlos no cambia la decisión de
 * arquitectura — cambia sólo qué pesos se cargan.
 *
 * Todos son abiertos y sin aprobación manual: el descargador de la app no puede autenticarse.
 */
export interface ModeloRemoto {
  id: string;
  label: string;
  url: string;
  bytes: number;
  /** Falso sólo para los de texto, que sirven para probar el runtime pero no para leer un cartel. */
  multimodal: boolean;
  /**
   * RAM disponible que el modelo necesita **con la visión activa**, según la documentación de la
   * librería. `null` cuando no está documentada.
   *
   * Es un dato aparte del tamaño del archivo y no se deduce de él: Gemma 4 E2B pesa 2,58 GB y pide
   * 4 GB. La diferencia es el codificador de visión, que se carga bajo demanda y **no entra en la
   * estimación de memoria** de la librería —que modela pesos y KV cache, o sea el camino de texto—.
   * Por eso el estimador puede decir "entra cómodo" y la carga fallar igual.
   */
  ramMinimaBytes: number | null;
}

export const MODELOS_REMOTOS: readonly ModeloRemoto[] = [
  {
    // El más chico con visión. Sin descargas registradas todavía: si falla, no sorprende.
    id: 'minicpm5-1b-int4',
    label: 'MiniCPM5 1B int4',
    url: 'https://huggingface.co/litert-community/MiniCPM5-1B/resolve/main/minicpm_wi4b32_wi8_afp32.litertlm',
    bytes: 792_723_456,
    multimodal: true,
    ramMinimaBytes: null,
  },
  {
    // El candidato de referencia: la mitad que Gemma 4, y el más usado de los que leen imagen.
    id: 'fastvlm-0.5b',
    label: 'FastVLM 0.5B',
    url: 'https://huggingface.co/litert-community/FastVLM-0.5B/resolve/main/FastVLM-0.5B.litertlm',
    bytes: 1_156_579_328,
    multimodal: true,
    ramMinimaBytes: null,
  },
  {
    id: 'smolvlm2-2.2b',
    label: 'SmolVLM2 2.2B',
    url: 'https://huggingface.co/litert-community/SmolVLM2-2.2B/resolve/main/SmolVLM2-2.2B.litertlm',
    bytes: 1_511_193_088,
    multimodal: true,
    ramMinimaBytes: null,
  },
  {
    id: 'qwen2-vl-2b',
    label: 'Qwen2-VL 2B',
    url: 'https://huggingface.co/litert-community/Qwen2-VL-2B/resolve/main/Qwen2-VL-2B.litertlm',
    bytes: 1_783_627_776,
    multimodal: true,
    ramMinimaBytes: null,
  },
  {
    id: 'gemma-4-e2b',
    label: 'Gemma 4 E2B',
    url: GEMMA_4_E2B_URL,
    bytes: GEMMA_4_E2B_BYTES,
    multimodal: true,
    // 4 GB+, documentado por la librería. Un iPhone 15 Pro reporta ~3,3 GB disponibles.
    ramMinimaBytes: 4 * 1024 ** 3,
  },
];

/** Modelo de la librería para Gemma 3n, público y sin autenticación (litert.dev). */
export const GEMMA_3N_E2B_URL = 'https://litert.dev/gemma-3n-E2B-it-int4.litertlm';
