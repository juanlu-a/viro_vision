/**
 * Benchmark de latencia contra un modelo de visión en la nube.
 *
 * Herramienta de desarrollo (paso 2 de la reunión con el tutor del 2026-08-10). No forma parte
 * del camino esencial de reconocimiento, que corre local y offline — ver ADR 0001.
 */
export {
  AnthropicHttpError,
  AnthropicNotConfiguredError,
  AnthropicStreamError,
  benchmarkBusVision,
} from './anthropicVision';
export {
  DEFAULT_MODEL_PROFILE,
  MODEL_PROFILES,
  findModelProfile,
  isAnthropicConfigured,
} from './config';
export type { ModelProfile } from './config';
export { buildRequestBody } from './request';
export { busReadingSchema, parseBusReading } from './schema';
export { formatBytes, formatMs, median, percentile, summarize } from './stats';
export type { LatencyMetric, MetricSummary } from './stats';
export type {
  BenchmarkOptions,
  BenchmarkResult,
  BusReading,
  EffortLevel,
  LatencyMarks,
  LatencyMs,
  ThinkingMode,
  TokenUsage,
} from './types';
