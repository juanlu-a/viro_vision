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
 * Contexto deliberadamente chico: el KV cache es el único término de memoria que controlamos, y el
 * prompt son dos frases más una imagen.
 */
export const MAX_CONTEXT_TOKENS = 1024;

/**
 * ¿Se muestra la pantalla del spike?
 *
 * Se gatea por variable de entorno y **no por `__DEV__`**: el spike hay que medirlo en un build de
 * Release corriendo en el teléfono sin la laptop cerca, que es donde `__DEV__` vale `false`. Mismo
 * criterio que el benchmark de nube, que se gatea por la presencia de la clave.
 */
export const isOnDeviceSpikeEnabled = (process.env.EXPO_PUBLIC_ONDEVICE_SPIKE ?? '') !== '';
