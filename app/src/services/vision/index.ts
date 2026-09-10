/**
 * Cloud vision: the supermarket-mode path (ADR 0006).
 *
 * Models chosen by measured latency, each showing up in the Home selector only when the build
 * carries its key. The bus path imports NOTHING from here: it runs locally (OCR over the banner
 * cropped by the TPU) because latency rules. Single import surface: `@/services/vision`.
 */
export {
  VisionHttpError,
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  VisionStreamError,
} from './errors';
export {
  DEFAULT_PRODUCT_MODEL_ID,
  PRODUCT_MODEL,
  PRODUCT_PROMPTS,
  buildProductRequest,
  parseProductReading,
  productSchema,
} from './product';
export type { ProductReading } from './product';
export { recognizeProduct } from './recognizeProduct';
export type { ProductRecognition } from './recognizeProduct';
export {
  MODEL_PROFILES,
  RETIRED_PROFILES,
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
export { PRODUCT_SYSTEM_PROMPT, PRODUCT_USER_PROMPT } from './providers/prompts';
export { acquireSlot, perMinuteLimit, remainingSlots, resetRateLimiter } from './rateLimiter';
export { DEFAULT_RETRY_WAIT_S, interpretHttpError } from './httpError';
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
