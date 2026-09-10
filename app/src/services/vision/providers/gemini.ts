/**
 * Gemini provider (Interactions API). Primary for supermarket mode: free tier with no card (ADR
 * 0006's free-for-the-user constraint).
 *
 * Shape verified AGAINST THE REAL API (August 2026), not only against the docs:
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   header  x-goog-api-key
 *   body    { model, input: [...], stream: true, response_format: {...} }
 *
 * The event discriminator is **`event_type`**, not `type` — the docs do not show it and reading it
 * wrong drops every event silently (zero text, TTFT as NaN). The real sequence:
 *
 *   interaction.created → interaction.status_update
 *   step.start { step: { type: 'thought' } }          ← the model thinks first
 *   step.delta { delta: { type: 'thought_signature' } }
 *   step.stop
 *   step.start { step: { type: 'model_output' } }     ← the visible text starts here
 *   step.delta { delta: { type: 'text', text } }      ← TTFT
 *   step.stop → interaction.completed
 *
 * A "thought" step before the text means the first visible answer takes as long as the thinking
 * does; `text-start` is emitted separately so that can be told apart.
 *
 * Pure module: it builds and translates, it does not touch the network. See providers.test.ts.
 */
import { GEMINI_INTERACTIONS_URL } from '../config';
import type {
  BuildRequestInput,
  ProviderEvent,
  ProviderRequest,
  TokenUsage,
  VisionProvider,
} from '../types';

function buildRequest(input: BuildRequestInput): ProviderRequest {
  return {
    url: GEMINI_INTERACTIONS_URL,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': input.apiKey,
    },
    body: {
      model: input.model.id,
      stream: true,
      // The system instruction goes as the first text block: the Interactions API receives
      // everything in a single `input`, with no separate `system` field.
      input: [
        { type: 'text', text: input.prompts.system },
        { type: 'image', data: input.imageBase64, mime_type: input.mediaType },
        { type: 'text', text: input.prompts.user },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: input.schema,
      },
      // Without this, Gemini thinks by default and the reading goes from ~3 s to tens of
      // seconds: the 'thought' step above is what eats the TTFT. The shape is also verified against
      // the real API — `thinking_config`, `thinking_budget`, `reasoning` and `effort` all give 400
      // ("Unknown parameter"); the only one that exists is `generation_config.thinking_level`, and
      // it only accepts 'minimal' | 'low' | 'medium' | 'high'.
      //
      // `minimal` is the floor and the Flash Lite models accept it, which are the only Gemini in
      // the registry. CAREFUL: the large Flash models (3.6, 3.7, flash-latest) REJECT it with 400
      // and demand at least 'low' — if one ever comes back to the registry, map its floor, do not
      // copy this line.
      generation_config: {
        thinking_level: input.thinking === 'off' ? 'minimal' : input.effort,
        max_output_tokens: input.maxTokens,
      },
    },
  };
}

/** The real discriminator is `event_type`; `type` is accepted as a fallback in case it changes again. */
export function eventTypeOf(payload: Record<string, unknown>): string | null {
  if (typeof payload.event_type === 'string') return payload.event_type;
  if (typeof payload.type === 'string') return payload.type;
  return null;
}

function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const type = eventTypeOf(payload);

  switch (type) {
    case 'step.start': {
      // Only the output step marks the start of the visible text; the 'thought' one does not.
      const step = payload.step as { type?: string } | undefined;
      return step?.type === 'model_output' ? { kind: 'text-start' } : { kind: 'start' };
    }
    case 'step.delta': {
      const delta = payload.delta as { type?: string; text?: string } | undefined;
      // The thinking step's deltas are 'thought_signature' and do not count as an answer.
      if (delta?.type === 'text' && typeof delta.text === 'string') {
        return { kind: 'text', text: delta.text };
      }
      return null;
    }
    case 'interaction.completed':
      // It is always a close, with or without usage attached. Returning only the usage would
      // lose the close marker and the total would be measured against the end of the stream,
      // inflated by transport.
      return { kind: 'stop', usage: readUsage(payload) };
    case 'interaction.failed':
    case 'error': {
      const error = payload.error as { message?: string; code?: string } | undefined;
      const message = error?.message ?? 'stream error';
      // The quota error carries how long to wait in the text itself ("Please retry in 29.2s").
      // Using it avoids guessing a backoff.
      const match = /retry in ([\d.]+)s/i.exec(message);
      return {
        kind: 'error',
        message,
        code: error?.code,
        retryAfterSeconds: match ? Math.ceil(Number(match[1])) : undefined,
      };
    }
    case 'interaction.created':
    case 'interaction.status_update':
      return { kind: 'start' };
    default:
      return null; // step.stop and future types
  }
}

/** Token usage can arrive in the close event; its exact location varies by version. */
function readUsage(payload: Record<string, unknown>): TokenUsage | undefined {
  const usage = (payload.usage ?? payload.usage_metadata) as
    | Record<string, number | undefined>
    | undefined;
  if (!usage) return undefined;

  const input = usage.input_tokens ?? usage.prompt_token_count ?? usage.promptTokenCount;
  const output = usage.output_tokens ?? usage.candidates_token_count ?? usage.candidatesTokenCount;
  if (input == null && output == null) return undefined;

  return { input_tokens: input ?? 0, output_tokens: output ?? 0 };
}

export const geminiProvider: VisionProvider = {
  id: 'gemini',
  label: 'Gemini',
  buildRequest,
  readEvent,
};
