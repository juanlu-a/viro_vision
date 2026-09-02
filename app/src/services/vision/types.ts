/**
 * Tipos de la capa de visión en la nube: el camino del modo supermercado (ADR 0006).
 *
 * El contrato es neutro respecto del proveedor: `VisionProvider` arma el request y traduce los
 * eventos SSE a `ProviderEvent`, y el motor (`reconocerProducto`) no sabe con quién habla. Así el
 * selector de modelo de Inicio cambia el modelo sin tocar el camino.
 */
import type { CloudProviderId, CloudRequest } from '@/services/cloud';


/**
 * Modo de razonamiento del modelo.
 * - `off`: sin thinking — latencia mínima. Único disponible en Haiku 4.5.
 * - `adaptive`: el modelo decide cuánto pensar. Requiere un modelo que lo soporte.
 */
export type ThinkingMode = 'off' | 'adaptive';

/**
 * Nivel de esfuerzo. Se limita a `low | medium | high` a propósito: la API rechaza (400)
 * `thinking: disabled` combinado con `xhigh` o `max`.
 */
export type EffortLevel = 'low' | 'medium' | 'high';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * Evento neutro. Cada proveedor traduce su propio formato SSE a esto, y el motor no sabe con
 * quién está hablando: los eventos se normalizan en UN solo lugar por proveedor.
 */
export type ProviderEvent =
  | { kind: 'start' }
  /** Arranca el bloque de texto visible (algunos proveedores lo señalan aparte). */
  | { kind: 'text-start' }
  | { kind: 'text'; text: string }
  | { kind: 'usage'; usage: TokenUsage }
  /**
   * Cierre. Puede traer el uso de tokens: algunos proveedores lo mandan EN el evento de
   * completado.
   */
  | {
      kind: 'stop';
      stopReason?: string;
      usage?: TokenUsage;
      /** El usage trae sólo output_tokens: hay que fusionarlo con lo registrado, no pisarlo. */
      usageIsPartial?: boolean;
    }
  | {
      kind: 'error';
      message: string;
      /** Código del proveedor, si lo trae. `quota_exceeded` se maneja distinto. */
      code?: string;
      /** Segundos que el proveedor pide esperar antes de reintentar. */
      retryAfterSeconds?: number;
    };

/** El mismo pedido HTTP que entiende el transporte de `services/cloud`. */
export type ProviderRequest = CloudRequest;

/** Qué se le pide al modelo. Un solo juego por tarea, compartido por todos los proveedores. */
export interface TaskPrompts {
  system: string;
  user: string;
}

export interface BuildRequestInput {
  model: ModelProfile;
  apiKey: string;
  maxTokens: number;
  thinking: ThinkingMode;
  effort: EffortLevel;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  /**
   * Prompt y forma de la respuesta de la tarea. Viven fuera del proveedor a propósito: si cada
   * proveedor tuviera su prompt, cambiar de modelo en el selector cambiaría también la pregunta,
   * y la comparación entre modelos dejaría de medir el modelo.
   */
  prompts: TaskPrompts;
  schema: Record<string, unknown>;
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

/**
 * Los proveedores del selector. Es la lista de `services/cloud` y no una propia: son los mismos que
 * el proxy sabe alcanzar, y tener dos listas sería tener dos que se desincronizan.
 *
 * `openai` y `groq` comparten implementación (`providers/openaiCompatible.ts`): son el mismo
 * dialecto apuntando a distinta URL. Siguen siendo ids distintos porque tienen clave, cuota y
 * factura separadas.
 */
export type VisionProviderId = CloudProviderId;

export interface ModelProfile {
  provider: VisionProviderId;
  id: string;
  /** Etiqueta para la UI (el selector de modelo de Inicio). */
  label: string;
  /** `output_config.effort` da 400 en algunos modelos (Haiku 4.5). Sólo aplica a Anthropic. */
  supportsEffort: boolean;
  /** Thinking adaptativo — existe desde la familia 4.6 de Anthropic. */
  supportsAdaptiveThinking: boolean;
  /** Techo de salida. La respuesta son dos campos cortos, así que alcanza muy poco. */
  maxTokens: number;
}
