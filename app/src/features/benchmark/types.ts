/**
 * Estado de la pantalla de benchmark. La lógica vive fuera del componente para que la pantalla
 * sea sólo presentación (y porque el proyecto todavía no tiene testing-library instalada).
 */
import type { BenchmarkResult, ModelProfile, ThinkingMode } from '@/services/vision';

export interface SelectedPhoto {
  uri: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

export type BenchmarkStatus = 'idle' | 'warmup' | 'running' | 'done' | 'error';

export interface BenchmarkState {
  status: BenchmarkStatus;
  /** Corrida en curso, 1-based. 0 cuando no hay ninguna. */
  currentRun: number;
  totalRuns: number;
  runs: BenchmarkResult[];
  /** Mensaje en español, listo para lector de pantalla. */
  message: string;
  photo: SelectedPhoto | null;
  model: ModelProfile;
  thinking: ThinkingMode;
}
