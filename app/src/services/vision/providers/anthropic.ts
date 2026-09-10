/**
 * Anthropic provider (Messages API). Secondary: it requires credit with a card (it does not meet
 * ADR 0006's free-for-the-user constraint on its own), so it shows up in the model selector only
 * when the build carries its key — it is there to contrast against another model family.
 *
 * Pure module: it builds and translates, it does not touch the network. See providers.test.ts.
 */
import { ANTHROPIC_MESSAGES_URL, ANTHROPIC_VERSION } from '../config';
import type { BuildRequestInput, ProviderEvent, ProviderRequest, VisionProvider } from '../types';

/**
 * Rules this builder honours — the API answers **400**, it does not ignore, a parameter the model
 * does not accept:
 *   - `output_config.effort` only when the profile supports it (Haiku 4.5 rejects it).
 *   - `thinking` is omitted entirely on models without adaptive thinking; not reasoning is exactly
 *     the behaviour we want for minimum latency.
 *   - `thinking: disabled` is only accepted with effort <= high, which is why EffortLevel stops at
 *     high.
 *   - The image block goes BEFORE the text one (API recommendation).
 */
function buildRequest(input: BuildRequestInput): ProviderRequest {
  const outputConfig: Record<string, unknown> = {
    format: { type: 'json_schema', schema: input.schema },
  };
  if (input.model.supportsEffort) {
    outputConfig.effort = input.effort;
  }

  const body: Record<string, unknown> = {
    model: input.model.id,
    max_tokens: input.maxTokens,
    stream: true,
    output_config: outputConfig,
    system: input.prompts.system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 },
          },
          { type: 'text', text: input.prompts.user },
        ],
      },
    ],
  };

  if (input.model.supportsAdaptiveThinking) {
    body.thinking = input.thinking === 'adaptive' ? { type: 'adaptive' } : { type: 'disabled' };
  }

  return {
    url: ANTHROPIC_MESSAGES_URL,
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body,
  };
}

function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const type = typeof payload.type === 'string' ? payload.type : null;

  switch (type) {
    case 'message_start': {
      const message = payload.message as { usage?: { input_tokens: number; output_tokens: number } };
      if (message?.usage) return { kind: 'usage', usage: { ...message.usage } };
      return { kind: 'start' };
    }
    case 'content_block_start': {
      const block = payload.content_block as { type?: string } | undefined;
      return block?.type === 'text' ? { kind: 'text-start' } : null;
    }
    case 'content_block_delta': {
      const delta = payload.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        return { kind: 'text', text: delta.text };
      }
      return null;
    }
    case 'message_delta': {
      // `message_delta` is the ONLY event with the final output-token count; the one in
      // `message_start` is the initial one (1-4). It carries only `output_tokens`, so it is marked
      // partial for the engine to merge instead of overwriting the input already recorded.
      const delta = payload.delta as { stop_reason?: string } | undefined;
      const usage = payload.usage as { output_tokens?: number } | undefined;
      return {
        kind: 'stop',
        stopReason: delta?.stop_reason,
        usage:
          usage?.output_tokens == null
            ? undefined
            : { input_tokens: 0, output_tokens: usage.output_tokens },
        usageIsPartial: usage?.output_tokens != null,
      };
    }
    case 'message_stop':
      return { kind: 'stop' };
    case 'error': {
      const error = payload.error as { message?: string } | undefined;
      return { kind: 'error', message: error?.message ?? 'stream error' };
    }
    default:
      return null; // ping and future types
  }
}

export const anthropicProvider: VisionProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  buildRequest,
  readEvent,
};
