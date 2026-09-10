/**
 * The **OpenAI-dialect** provider: a single module for OpenAI and Groq (and tomorrow for the model
 * we host ourselves — see [ADR 0008]).
 *
 * All three speak the same protocol —`POST /v1/chat/completions`, `Authorization: Bearer`, the
 * image as a data URI in an `image_url` content part, deltas in `choices[0].delta.content`— so it
 * is parameterized by URL instead of writing three nearly identical providers. vLLM, Ollama and TGI
 * expose that same dialect, which is why adding the Arnaldo Castro endpoint will be configuration
 * and not code.
 *
 * Pure module: it builds and translates, it does not touch the network. See providers.test.ts.
 */
import type {
  BuildRequestInput,
  ProviderEvent,
  ProviderRequest,
  TokenUsage,
  VisionProvider,
  VisionProviderId,
} from '../types';

/**
 * Translates our `ThinkingMode`/`EffortLevel` into the dialect's parameter.
 *
 * **Measured 2026-09-02, and the result corrects what this comment used to say.** It was written
 * assuming the same thing would happen here as in Gemini —where not turning thinking off takes the
 * reading from 3 s to tens of seconds— and on these models **it does not**: `gpt-5.6-luna` takes the
 * same with `none` (1.5-2.1 s) as with `medium` (1.5 s) as with nothing sent at all (2.0 s), and
 * returns the same 35 output tokens in all three cases. On a three-short-field task it spends no
 * reasoning tokens even when allowed to.
 *
 * `'none'` is still sent, for two reasons that are not today's latency: it is the correct intent (we
 * do not want it to reason) and it is free insurance if the task grows — the optional label-OCR goal
 * would make it longer. What gets corrected is the **justification**: here it does not buy the
 * seconds it buys in Gemini.
 *
 * CAREFUL when adding a model: valid values differ by provider. OpenAI documents
 * `none | low | medium | high | xhigh | max`. Groq documents only `none | default`, **but it
 * accepted `low` with a 200** in that same measurement — i.e. its documentation is not the real
 * list. `'none'` is the only one both guarantee, and it is what supermarket mode uses.
 */
function reasoningEffort(input: BuildRequestInput): string {
  return input.thinking === 'off' ? 'none' : input.effort;
}

function buildRequest(url: string, input: BuildRequestInput): ProviderRequest {
  return {
    url,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body: {
      model: input.model.id,
      stream: true,
      // Without this the stream carries token usage in no event at all.
      stream_options: { include_usage: true },
      // `max_tokens` is deprecated in the dialect and incompatible with reasoning models, which are
      // exactly the ones we use.
      max_completion_tokens: input.maxTokens,
      reasoning_effort: reasoningEffort(input),
      messages: [
        { role: 'system', content: input.prompts.system },
        {
          role: 'user',
          content: [
            // The image travels as a data URI, not as a separate field: it is the only form the
            // dialect accepts for local bytes.
            {
              type: 'image_url',
              image_url: { url: `data:${input.mediaType};base64,${input.imageBase64}` },
            },
            { type: 'text', text: input.prompts.user },
          ],
        },
      ],
      // `strict: true` does constrained decoding: the model *cannot* return another shape. It is
      // stronger than `{ type: 'json_object' }`, which only guarantees syntactic JSON and leaves
      // field names to the model's discretion — with that, `parseProductReading` bounces a correct
      // answer for having called it "producto" instead of "kind".
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'product_reading', schema: input.schema, strict: true },
      },
    },
  };
}

/**
 * The dialect has no event types: every frame is a `chat.completion.chunk` and what changes is
 * which fields come filled in. That is why it is read by field presence and not by a discriminator,
 * unlike Gemini and Anthropic.
 */
function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const error = payload.error as { message?: string; code?: string; type?: string } | undefined;
  if (error) {
    const message = error.message ?? 'stream error';
    // The dialect marks quota with `code: 'rate_limit_exceeded'`. It is normalized to the
    // `quota_exceeded` the engine already understands, and the "try again in 1.5s" both providers
    // put in the text itself is used instead of guessing a backoff.
    const isQuota = error.code === 'rate_limit_exceeded' || error.type === 'rate_limit_exceeded';
    const match = /try again in ([\d.]+)s/i.exec(message);
    return {
      kind: 'error',
      message,
      code: isQuota ? 'quota_exceeded' : error.code,
      retryAfterSeconds: match ? Math.ceil(Number(match[1])) : undefined,
    };
  }

  const usage = readUsage(payload);
  const choice = (payload.choices as { delta?: { content?: unknown }; finish_reason?: unknown }[])?.[0];

  // `include_usage`'s final frame arrives with `choices: []` and only the usage: it is the close.
  if (!choice) return usage ? { kind: 'stop', usage } : null;

  if (typeof choice.finish_reason === 'string') {
    return { kind: 'stop', stopReason: choice.finish_reason, usage };
  }
  if (typeof choice.delta?.content === 'string' && choice.delta.content.length > 0) {
    return { kind: 'text', text: choice.delta.content };
  }
  // The first delta carries only `role: 'assistant'`: it is the start of the visible text.
  if (choice.delta) return { kind: 'text-start' };
  return null;
}

function readUsage(payload: Record<string, unknown>): TokenUsage | undefined {
  const usage = payload.usage as Record<string, number | undefined> | null | undefined;
  if (!usage) return undefined;
  const input = usage.prompt_tokens;
  const output = usage.completion_tokens;
  if (input == null && output == null) return undefined;
  return { input_tokens: input ?? 0, output_tokens: output ?? 0 };
}

/** Builds a dialect provider pointing at a concrete base URL. */
export function createOpenAiCompatibleProvider(options: {
  id: VisionProviderId;
  label: string;
  url: string;
}): VisionProvider {
  return {
    id: options.id,
    label: options.label,
    buildRequest: (input) => buildRequest(options.url, input),
    readEvent,
  };
}
