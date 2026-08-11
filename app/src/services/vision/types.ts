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

/**
 * Evento neutro del benchmark. Cada proveedor traduce su propio formato SSE a esto, y el motor
 * de medición no sabe con quién está hablando.
 *
 * Existe para que los timestamps se tomen en UN solo lugar: si cada proveedor midiera por su
 * cuenta, los números dejarían de ser comparables entre sí sin que nadie lo note — que es
 * exactamente el error que arruinaría el experimento.
 */
export type ProviderEvent =
  | { kind: 'start' }
  /** Arranca el bloque de texto visible (algunos proveedores lo señalan aparte). */
  | { kind: 'text-start' }
  | { kind: 'text'; text: string }
  | { kind: 'usage'; usage: TokenUsage }
  /**
   * Cierre. Puede traer el uso de tokens: algunos proveedores lo mandan EN el evento de
   * completado, y devolver sólo el uso perdería la marca de cierre — el total quedaría medido
   * contra el fin del stream (que incluye latencia de transporte) en vez del evento real.
   */
  | {
      kind: 'stop';
      stopReason?: string;
      usage?: TokenUsage;
      /** El usage trae sólo output_tokens: hay que fusionarlo con lo registrado, no pisarlo. */
      usageIsPartial?: boolean;
    }
  | { kind: 'error'; message: string };

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface BuildRequestInput {
  model: ModelProfile;
  apiKey: string;
  maxTokens: number;
  thinking: ThinkingMode;
  effort: EffortLevel;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
}

/** Un proveedor de visión en la nube: cómo se le pide, y cómo se lee lo que devuelve. */
export interface VisionProvider {
  id: VisionProviderId;
  label: string;
  buildRequest(input: BuildRequestInput): ProviderRequest;
  /**
   * Traduce un payload SSE ya parseado a un evento neutro. Devuelve null para lo que no
   * interesa (keep-alives, tipos desconocidos, eventos futuros).
   */
  readEvent(payload: Record<string, unknown>): ProviderEvent | null;
}

export type VisionProviderId = 'gemini' | 'anthropic';

export interface ModelProfile {
  provider: VisionProviderId;
  id: string;
  /** Etiqueta para la UI. */
  label: string;
  /** `output_config.effort` da 400 en algunos modelos (Haiku 4.5). Sólo aplica a Anthropic. */
  supportsEffort: boolean;
  /** Thinking adaptativo — existe desde la familia 4.6 de Anthropic. */
  supportsAdaptiveThinking: boolean;
  /** Techo de salida. La respuesta son dos campos cortos, así que alcanza muy poco. */
  maxTokens: number;
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
  provider: VisionProviderId;
  thinking: ThinkingMode;
  effort: EffortLevel;
  /** Date.now() — sólo como etiqueta legible del run, nunca para calcular duraciones. */
  startedAtEpoch: number;
}
