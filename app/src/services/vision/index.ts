/**
 * Visión en la nube: el camino del modo supermercado (ADR 0006).
 *
 * Cinco modelos elegidos por latencia, de cuatro proveedores; cada uno aparece en el selector de
 * Inicio sólo si el build trae su clave, y Gemini es el default por ser el único gratuito sin
 * tarjeta. El camino de ómnibus NO importa nada de acá: corre local (OCR sobre el banner recortado
 * por la TPU) porque la latencia manda. Único punto de import: `@/services/vision`.
 */
export {
  VisionHttpError,
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  VisionStreamError,
} from './errors';
export {
  DEFAULT_PRODUCTO_MODEL_ID,
  PRODUCTO_MODEL,
  PRODUCTO_PROMPTS,
  buildProductoRequest,
  parseProductoLeido,
  productoSchema,
} from './producto';
export type { ProductoLeido } from './producto';
export { reconocerProducto } from './reconocerProducto';
export type { ReconocimientoProducto } from './reconocerProducto';
export {
  MODEL_PROFILES,
  availableModels,
  defaultModel,
  findModelProfile,
  isAnthropicConfigured,
  isGeminiConfigured,
  isGroqConfigured,
  isOpenaiConfigured,
  isProviderConfigured,
  isVisionConfigured,
} from './config';
export { anthropicProvider, geminiProvider, getProvider, groqProvider, openaiProvider } from './providers';
export { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './providers/prompts';
export { acquireSlot, limitePorMinuto, remainingSlots, resetRateLimiter } from './rateLimiter';
export { ESPERA_POR_DEFECTO_S, interpretarErrorHttp } from './httpError';
export { parseJsonRecord } from './schema';
export type {
  EffortLevel,
  ModelProfile,
  ProviderEvent,
  TaskPrompts,
  ThinkingMode,
  TokenUsage,
  VisionProvider,
  VisionProviderId,
} from './types';
