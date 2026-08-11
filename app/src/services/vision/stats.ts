/**
 * Estadística del benchmark. Módulo puro (ver stats.test.ts).
 *
 * Se reportan mediana y p90, no promedio: con pocas muestras un outlier de red arrastra la media
 * y da un número que no representa nada.
 */
import type { BenchmarkResult, LatencyMs } from './types';

export type LatencyMetric = keyof LatencyMs;

export interface MetricSummary {
  metric: LatencyMetric;
  /** Cuántas corridas aportaron un valor válido a esta métrica. */
  samples: number;
  medianMs: number;
  p90Ms: number;
  minMs: number;
  maxMs: number;
}

/** Percentil por interpolación lineal. `values` NO necesita venir ordenado. */
export function percentile(values: number[], p: number): number {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (finite.length === 0) return NaN;
  if (finite.length === 1) return finite[0];

  const rank = (finite.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return finite[lower];
  return finite[lower] + (finite[upper] - finite[lower]) * (rank - lower);
}

export function median(values: number[]): number {
  return percentile(values, 0.5);
}

/** Resume una métrica a lo largo de varias corridas, ignorando las que no la alcanzaron. */
export function summarize(runs: BenchmarkResult[], metric: LatencyMetric): MetricSummary {
  const values = runs.map((run) => run.ms[metric]).filter((value) => Number.isFinite(value));

  return {
    metric,
    samples: values.length,
    medianMs: median(values),
    p90Ms: percentile(values, 0.9),
    minMs: values.length === 0 ? NaN : Math.min(...values),
    maxMs: values.length === 0 ? NaN : Math.max(...values),
  };
}

/** Formatea milisegundos para la UI. Devuelve '—' si la marca no se alcanzó. */
export function formatMs(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

/** Formatea el tamaño del base64 enviado. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} kB`;
}
