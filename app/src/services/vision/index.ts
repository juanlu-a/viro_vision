/**
 * Benchmark de latencia contra un modelo de visión en la nube.
 *
 * Herramienta de desarrollo (paso 2 de la reunión con el tutor del 2026-08-10). No forma parte
 * del camino esencial de reconocimiento, que corre local y offline — ver ADR 0001.
 *
 * Gemini es el proveedor primario (tier gratuito, misma familia que Gemma); Anthropic queda
 * disponible para contrastar contra otra familia de modelos.
 */
export {
  VisionHttpError,
  VisionNotConfiguredError,
  VisionStreamError,
  benchmarkBusVision,
} from './benchmark';
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
