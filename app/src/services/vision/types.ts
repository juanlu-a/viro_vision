/**
 * Tipos del benchmark de latencia contra un modelo de visión en la nube.
 *
 * La forma de `BusReading` imita deliberadamente la salida JSON que devuelve Gemma
 * (línea + destino + confianza), para que los resultados nube vs. local sean comparables.
 */

export interface BusReading {
  /** Número de línea leído del cartel frontal, o null si no se pudo leer. */
  line: string | null;
  /** Destino leído del cartel, o null. */
  destination: string | null;
  /** Confianza declarada por el modelo, 0..1. */
  confidence: number;
  /** Todo el texto que el modelo distinguió en el cartel, en orden de lectura. */
  raw_text: string[];
}

/**
 * Modo de razonamiento del modelo.
 * - `off`: thinking deshabilitado — el brazo de latencia mínima.
 * - `adaptive`: el modelo decide cuánto pensar — el brazo de calidad por defecto.
 */
export type ThinkingMode = 'off' | 'adaptive';

/**
 * Nivel de esfuerzo. Se limita a `low | medium | high` a propósito: la API rechaza (400)
 * `thinking: disabled` combinado con `xhigh` o `max`.
 */
export type EffortLevel = 'low' | 'medium' | 'high';

export interface BenchmarkOptions {
  /** Imagen en base64, SIN el prefijo `data:image/...;base64,`. */
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  /** Por defecto 'off' (brazo de latencia mínima). */
  thinking?: ThinkingMode;
  /** Por defecto 'low'. */
  effort?: EffortLevel;
  /** Por defecto 512 con thinking off, 4096 con adaptive (max_tokens acota thinking + texto). */
  maxTokens?: number;
  /** Modelo a medir. Por defecto `VISION_MODEL`. */
  model?: string;
  signal?: AbortSignal;
  /**
   * Se llama por cada fragmento de texto recibido. El caller es responsable de throttlear:
   * hacer setState por delta desplaza los timestamps y arruina la medición.
   */
  onTextDelta?: (chunk: string) => void;
}

/**
 * Marcas de tiempo crudas, todas lecturas de `performance.now()` (monótono, sub-ms).
 * Las opcionales quedan undefined si la corrida falló antes de llegar a ese punto.
 */
export interface LatencyMarks {
  /** Justo antes de emitir el POST. */
  requestSentAt: number;
  /** El `await fetch()` resolvió (headers recibidos). */
  headersAt?: number;
  /** Primer chunk con datos del reader. */
  firstByteAt?: number;
  /** Evento `message_start`. */
  firstEventAt?: number;
  /** `content_block_start` de tipo `text` — arranca la respuesta visible. */
  firstTextBlockAt?: number;
  /** Primer `text_delta`. Este es el TTFT que pidió el tutor. */
  firstTextDeltaAt?: number;
  /** `message_stop` o fin del stream. */
  doneAt?: number;
}

/** Duraciones derivadas, en milisegundos desde `requestSentAt`. NaN si la marca no se alcanzó. */
export interface LatencyMs {
  toHeaders: number;
  toFirstByte: number;
  toFirstEvent: number;
  toFirstTextBlock: number;
  /** Time to first token — la métrica principal. */
  toFirstTextDelta: number;
  total: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface BenchmarkResult {
  marks: LatencyMarks;
  ms: LatencyMs;
  /** Cuántos eventos SSE de cada tipo llegaron. Útil para explicar huecos en el timeline. */
  eventCounts: Record<string, number>;
  usage: TokenUsage | null;
  stopReason: string | null;
  /** Texto completo acumulado de los `text_delta`. */
  text: string;
  /** `text` parseado contra el schema, o null si no validó. */
  parsed: BusReading | null;
  /** Tamaño del base64 enviado, en bytes. El eje que suele dominar la latencia. */
  imageBase64Bytes: number;
  model: string;
  thinking: ThinkingMode;
  effort: EffortLevel;
  /** Date.now() — sólo como etiqueta legible del run, nunca para calcular duraciones. */
  startedAtEpoch: number;
}
