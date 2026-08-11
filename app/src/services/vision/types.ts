/**
 * Tipos del benchmark de latencia contra un modelo de visión en la nube.
 *
 * `BusReading` son sólo los dos datos que el anuncio de voz necesita: número de línea y nombre.
 * Deliberadamente mínimo — cada campo extra es salida que hay que generar, y la salida es tiempo.
 * La misma forma se le pide a Gemma cuando corra local, para que los números sean comparables.
 */

export interface BusReading {
  /** Número de línea del cartel frontal (ej. "116"), o null si no se pudo leer. */
  numero: string | null;
  /** Nombre / destino de la línea (ej. "Plaza Independencia"), o null. */
  nombre: string | null;
}

/**
 * Modo de razonamiento del modelo.
 * - `off`: sin thinking — el brazo de latencia mínima. Único disponible en Haiku 4.5.
 * - `adaptive`: el modelo decide cuánto pensar. Requiere un modelo que lo soporte.
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
