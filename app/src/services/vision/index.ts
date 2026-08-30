/**
 * Visión en la nube: el camino del modo supermercado (ADR 0006).
 *
 * Gemini es el proveedor primario (tier gratuito: la restricción de gratuidad de ADR 0006);
 * Anthropic aparece en el selector sólo si el build trae su clave. El camino de ómnibus NO importa
 * nada de acá: corre local (OCR sobre el banner recortado por la TPU) porque la latencia manda.
 * Único punto de import: `@/services/vision`.
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
  isProviderConfigured,
  isVisionConfigured,
} from './config';
export { anthropicProvider, geminiProvider, getProvider } from './providers';
export { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './providers/prompts';
export { acquireSlot, remainingSlots, resetRateLimiter } from './rateLimiter';
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
