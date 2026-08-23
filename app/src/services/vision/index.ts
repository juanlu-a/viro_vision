/**
 * Visión en la nube: el benchmark de latencia (instrumentación de desarrollo, ADR 0001) y el
 * camino de producto de supermercado (candidato nube de ADR 0006, decisión pendiente).
 *
 * Gemini es el proveedor primario (tier gratuito, misma familia que Gemma); Anthropic queda
 * disponible para contrastar contra otra familia de modelos. El camino de ómnibus NO importa
 * nada de acá: corre local (detección + OCR) porque la latencia manda — ver ADR 0006.
 */
export { benchmarkBusVision } from './benchmark';
export {
  VisionHttpError,
  VisionNotConfiguredError,
  VisionQuotaError,
  VisionStreamError,
} from './errors';
export {
  PRODUCTO_MODEL,
  buildProductoRequest,
  parseProductoLeido,
  productoSchema,
} from './producto';
export type { ProductoLeido } from './producto';
export { reconocerProducto } from './reconocerProducto';
export type { ReconocimientoProducto } from './reconocerProducto';
export {
  JSON_SHAPE_PROMPT,
  PRODUCTO_JSON_SHAPE_PROMPT,
  PRODUCTO_SYSTEM_PROMPT,
  PRODUCTO_USER_PROMPT,
  SYSTEM_PROMPT,
  USER_PROMPT,
} from './providers/prompts';
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
export { acquireSlot, remainingSlots, resetRateLimiter } from './rateLimiter';
export { busReadingSchema, parseBusReading } from './schema';
export { formatBytes, formatMs, median, percentile, summarize } from './stats';
export type { LatencyMetric, MetricSummary } from './stats';
export type {
  BenchmarkOptions,
  BenchmarkResult,
  BuildRequestInput,
  BusReading,
  EffortLevel,
  LatencyMarks,
  LatencyMs,
  ModelProfile,
  ProviderEvent,
  ThinkingMode,
  TokenUsage,
  VisionProvider,
  VisionProviderId,
} from './types';
