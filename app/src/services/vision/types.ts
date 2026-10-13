/**
 * Types of the cloud vision layer: the supermarket-mode path (ADR 0006).
 *
 * The contract is provider-neutral: `VisionProvider` builds the request and translates SSE events
 * into `ProviderEvent`, and the engine (`recognizeProduct`) does not know who it is talking to.
 * That is how the Home model selector switches models without touching the path.
 */
import type { CloudProviderId, CloudRequest } from '@/services/cloud';


/**
 * The model's reasoning mode.
 * - `off`: no thinking — minimum latency. The only one available on Haiku 4.5.
 * - `adaptive`: the model decides how much to think. Requires a model that supports it.
 */
export type ThinkingMode = 'off' | 'adaptive';

/**
 * Effort level. Deliberately limited to `low | medium | high`: the API rejects (400)
 * `thinking: disabled` combined with `xhigh` or `max`.
 */
export type EffortLevel = 'low' | 'medium' | 'high';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * A neutral event. Each provider translates its own SSE format into this, and the engine does not
 * know who it is talking to: events are normalized in ONE place per provider.
 */
export type ProviderEvent =
  | { kind: 'start' }
  /** The visible text block starts (some providers signal it separately). */
  | { kind: 'text-start' }
  | { kind: 'text'; text: string }
  | { kind: 'usage'; usage: TokenUsage }
  /**
   * Close. It may carry token usage: some providers send it IN the completion event.
   */
  | {
      kind: 'stop';
      stopReason?: string;
      usage?: TokenUsage;
      /** The usage carries only output_tokens: it has to be merged with what was recorded, not overwrite it. */
      usageIsPartial?: boolean;
    }
  | {
      kind: 'error';
      message: string;
      /** The provider's code, when it carries one. `quota_exceeded` is handled differently. */
      code?: string;
      /** Seconds the provider asks us to wait before retrying. */
      retryAfterSeconds?: number;
    };

/** The very same HTTP request the `services/cloud` transport understands. */
export type ProviderRequest = CloudRequest;

/** What the model is asked for. One set per task, shared by every provider. */
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
   * The task's prompt and response shape. They live outside the provider on purpose: if each
   * provider had its own prompt, switching models in the selector would also change the question,
   * and comparing models would stop measuring the model.
   */
  prompts: TaskPrompts;
  schema: Record<string, unknown>;
}

/** A cloud vision provider: how it is asked, and how what it returns is read. */
export interface VisionProvider {
  id: VisionProviderId;
  label: string;
  buildRequest(input: BuildRequestInput): ProviderRequest;
  /**
   * Translates an already-parsed SSE payload into a neutral event. Returns null for anything that
   * does not matter (keep-alives, unknown types, future events).
   */
  readEvent(payload: Record<string, unknown>): ProviderEvent | null;
}

/**
 * The providers in the selector. It is the `services/cloud` list and not one of its own: they are
 * the same ones the proxy knows how to reach, and having two lists would mean having two that drift
 * apart.
 *
 * `openai` and `groq` share an implementation (`providers/openaiCompatible.ts`): they are the same
 * dialect pointing at different URLs. They stay separate ids because they have separate keys,
 * quotas and bills.
 */
export type VisionProviderId = CloudProviderId;

export interface ModelProfile {
  provider: VisionProviderId;
  id: string;
  /** Label for the UI (the Home model selector). */
  label: string;
  /** `output_config.effort` returns 400 on some models (Haiku 4.5). Anthropic only. */
  supportsEffort: boolean;
  /** Adaptive thinking — exists from Anthropic's 4.6 family onwards. */
  supportsAdaptiveThinking: boolean;
  /** Output ceiling. The answer is two short fields, so very little is enough. */
  maxTokens: number;
}
