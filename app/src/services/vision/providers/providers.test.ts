import { MODEL_PROFILES, RETIRED_PROFILES, findModelProfile } from '../config';
import { DEFAULT_PRODUCT_MODEL_ID, PRODUCT_PROMPTS, productSchema } from '../product';
import type { BuildRequestInput, ModelProfile } from '../types';
import { anthropicProvider, geminiProvider, getProvider, groqProvider, openaiProvider } from './index';

/**
 * Gemini and Anthropic left the selector on 2026-09-02, but their provider modules are still in the
 * binary and have to keep being tested: the day one comes back, it comes back through its profile,
 * not through new code. The profiles are taken from `RETIRED_PROFILES` and not from
 * `findModelProfile`, which deliberately does NOT look there — a retired id has to fall back to the
 * default.
 */
const retired = (id: string) => RETIRED_PROFILES.find((p) => p.id === id)!;
const gemini = retired('gemini-3.5-flash-lite');
const haiku = retired('claude-haiku-4-5');
/**
 * A synthetic profile, not one from the registry: `claude-opus-5` left the selector on 2026-09-01
 * (ADR 0006), but the provider's two capability branches —sending `effort` and sending `thinking`—
 * still exist in the code and have to be covered. Tying them to a concrete registry model made them
 * break every time the list changes, which is a reason unrelated to what the test verifies.
 */
const withThinking: ModelProfile = {
  ...retired('claude-haiku-4-5'),
  id: 'model-with-thinking',
  supportsEffort: true,
  supportsAdaptiveThinking: true,
};

function inputFor(model: ModelProfile, overrides: Partial<BuildRequestInput> = {}) {
  return {
    model,
    apiKey: 'test-key',
    maxTokens: model.maxTokens,
    thinking: 'off' as const,
    effort: 'low' as const,
    imageBase64: 'QUJD',
    mediaType: 'image/jpeg' as const,
    prompts: PRODUCT_PROMPTS,
    schema: productSchema,
    ...overrides,
  };
}

describe('geminiProvider.buildRequest', () => {
  it('passes the key in the x-goog-api-key header, not in the query string', () => {
    const request = geminiProvider.buildRequest(inputFor(gemini));

    expect(request.headers['x-goog-api-key']).toBe('test-key');
    expect(request.url).not.toContain('test-key');
  });

  it('asks for streaming — without it there is no time to first token', () => {
    expect(geminiProvider.buildRequest(inputFor(gemini)).body.stream).toBe(true);
  });

  it('asks for JSON with the schema and prompts it receives, not with its own', () => {
    const body = geminiProvider.buildRequest(inputFor(gemini)).body as {
      response_format: { mime_type: string; schema: unknown };
      input: { type: string; text?: string }[];
    };

    expect(body.response_format.mime_type).toBe('application/json');
    expect(body.response_format.schema).toBe(productSchema);
    expect(body.input.filter((b) => b.type === 'text').map((b) => b.text)).toEqual([
      PRODUCT_PROMPTS.system,
      PRODUCT_PROMPTS.user,
    ]);
  });

  it('turns thinking off: without thinking_level the reading goes from 2-3 s to tens of seconds', () => {
    const { generation_config: gc } = geminiProvider.buildRequest(inputFor(gemini)).body as {
      generation_config: { thinking_level: string; max_output_tokens: number };
    };

    // 'minimal' is the floor the Flash Lite models accept; the large Flash ones reject it with 400.
    expect(gc.thinking_level).toBe('minimal');
    expect(gc.max_output_tokens).toBe(gemini.maxTokens);
  });

  it('with adaptive thinking it sends the effort as the level, not an invented value', () => {
    const { generation_config: gc } = geminiProvider.buildRequest(
      inputFor(gemini, { thinking: 'adaptive', effort: 'medium' }),
    ).body as { generation_config: { thinking_level: string } };

    expect(gc.thinking_level).toBe('medium');
  });

  it('sends the image with its mime type', () => {
    const { input } = geminiProvider.buildRequest(inputFor(gemini, { mediaType: 'image/png' }))
      .body as { input: { type: string; mime_type?: string; data?: string }[] };
    const image = input.find((block) => block.type === 'image');

    expect(image?.mime_type).toBe('image/png');
    expect(image?.data).toBe('QUJD');
  });
});

/**
 * Payloads captured from a real run against the API (August 2026). They are deliberately not made
 * up from the docs: the docs do not show that the discriminator is `event_type`, and reading it
 * wrong drops every event silently.
 */
const REAL_GEMINI_EVENTS = {
  created: { interaction: { status: 'in_progress' }, event_type: 'interaction.created' },
  statusUpdate: { status: 'in_progress', event_type: 'interaction.status_update' },
  thoughtStart: { index: 0, step: { type: 'thought' }, event_type: 'step.start' },
  thoughtDelta: {
    index: 0,
    delta: { signature: 'Et0ECtoEARFN', type: 'thought_signature' },
    event_type: 'step.delta',
  },
  stepStop: { index: 0, event_type: 'step.stop' },
  outputStart: { index: 1, step: { type: 'model_output' }, event_type: 'step.start' },
  textDelta: {
    index: 1,
    delta: { text: '{\n  "kind": null,\n  "brand": null\n}', type: 'text' },
    event_type: 'step.delta',
  },
  completed: { event_type: 'interaction.completed' },
};

describe('geminiProvider.readEvent', () => {
  it('reads the discriminator from event_type, not from type', () => {
    // If it read `type`, this event would be dropped and the TTFT would end up NaN.
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.textDelta)).toEqual({
      kind: 'text',
      text: '{\n  "kind": null,\n  "brand": null\n}',
    });
  });

  it('marks the text start only on the output step, not on the thinking one', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.outputStart)).toEqual({ kind: 'text-start' });
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.thoughtStart)).toEqual({ kind: 'start' });
  });

  it('does not count the thinking delta as answer text', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.thoughtDelta)).toBeNull();
  });

  it('closes on interaction.completed', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.completed)).toEqual({ kind: 'stop' });
  });

  it('ignores step.stop and future types instead of breaking', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.stepStop)).toBeNull();
    expect(geminiProvider.readEvent({ event_type: 'something.new.from.the.future' })).toBeNull();
  });

  it('reports the stream error', () => {
    const event = geminiProvider.readEvent({
      event_type: 'error',
      error: { message: 'quota exhausted' },
    });

    expect(event).toEqual({ kind: 'error', message: 'quota exhausted' });
  });

  it('walks the whole real sequence and produces exactly one text and one close', () => {
    const kinds = Object.values(REAL_GEMINI_EVENTS)
      .map((payload) => geminiProvider.readEvent(payload))
      .filter((event) => event !== null)
      .map((event) => event.kind);

    expect(kinds.filter((kind) => kind === 'text')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'text-start')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'stop')).toHaveLength(1);
  });
});

describe('anthropicProvider.buildRequest', () => {
  it('uses the schema and prompts it receives — the same set as Gemini', () => {
    const body = anthropicProvider.buildRequest(inputFor(haiku)).body as {
      output_config: { format: { type: string; schema: unknown } };
      system: string;
      messages: { content: { type: string; text?: string }[] }[];
    };

    expect(body.output_config.format).toEqual({ type: 'json_schema', schema: productSchema });
    expect(body.system).toBe(PRODUCT_PROMPTS.system);
    expect(body.messages[0].content.find((c) => c.type === 'text')?.text).toBe(PRODUCT_PROMPTS.user);
  });

  it('on Haiku 4.5 it does NOT send effort — the API rejects it with 400', () => {
    const { output_config: outputConfig } = anthropicProvider.buildRequest(inputFor(haiku)).body as {
      output_config: Record<string, unknown>;
    };

    expect(outputConfig).not.toHaveProperty('effort');
  });

  it('on Haiku 4.5 it does NOT send thinking — the model does not support the adaptive one', () => {
    expect(anthropicProvider.buildRequest(inputFor(haiku)).body).not.toHaveProperty('thinking');
  });

  it('on Haiku 4.5 it ignores a request for adaptive thinking instead of sending an invalid body', () => {
    const body = anthropicProvider.buildRequest(inputFor(haiku, { thinking: 'adaptive' })).body;

    expect(body).not.toHaveProperty('thinking');
  });

  it('on a model that supports them it does send effort and thinking', () => {
    const body = anthropicProvider.buildRequest(inputFor(withThinking, { thinking: 'adaptive' })).body as {
      output_config: { effort: string };
      thinking: unknown;
    };

    expect(body.output_config.effort).toBe('low');
    expect(body.thinking).toEqual({ type: 'adaptive' });
  });

  it('puts the image before the text', () => {
    const { messages } = anthropicProvider.buildRequest(inputFor(haiku)).body as {
      messages: { content: { type: string }[] }[];
    };

    expect(messages[0].content.map((block) => block.type)).toEqual(['image', 'text']);
  });
});

describe('anthropicProvider.readEvent', () => {
  it('reads the incremental text of a content_block_delta', () => {
    const event = anthropicProvider.readEvent({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: '6' },
    });

    expect(event).toEqual({ kind: 'text', text: '6' });
  });

  it('marks the start of the visible text block', () => {
    const event = anthropicProvider.readEvent({
      type: 'content_block_start',
      content_block: { type: 'text' },
    });

    expect(event).toEqual({ kind: 'text-start' });
  });

  it('does not mark a text start for a thinking block', () => {
    const event = anthropicProvider.readEvent({
      type: 'content_block_start',
      content_block: { type: 'thinking' },
    });

    expect(event).toBeNull();
  });

  it('reads token usage from message_start', () => {
    const event = anthropicProvider.readEvent({
      type: 'message_start',
      message: { usage: { input_tokens: 1200, output_tokens: 0 } },
    });

    expect(event).toEqual({ kind: 'usage', usage: { input_tokens: 1200, output_tokens: 0 } });
  });

  it('ignores the ping', () => {
    expect(anthropicProvider.readEvent({ type: 'ping' })).toBeNull();
  });
});

describe('model registry', () => {
  it('every profile points at a provider with an implementation', () => {
    for (const profile of MODEL_PROFILES) {
      expect(getProvider(profile.provider)).toBeDefined();
      expect(getProvider(profile.provider).id).toBe(profile.provider);
    }
  });

  it('does not offer two models from the same provider', () => {
    // The selector is a radiogroup walked with VoiceOver: every extra option is one more swipe
    // between the person and the reading, and two rungs of the same family do not add a different
    // comparison. That is why `gemini-flash-lite-latest` and `claude-opus-5` left (ADR 0006,
    // 2026-09-01 update). If this test fails, the decision has to be reopened, not adjusted.
    const providers = MODEL_PROFILES.map((profile) => profile.provider);

    expect(new Set(providers).size).toBe(providers.length);
  });

  it('the first one in the selector is the default', () => {
    // With no stored preference the app uses DEFAULT_PRODUCT_MODEL_ID, and the selector shows the
    // first one as checked. If they stopped matching, the user would see a model checked that is
    // not the one actually reading — a state communicated wrong, which is the worst thing that can
    // happen in an interface walked blind.
    expect(MODEL_PROFILES[0].id).toBe(DEFAULT_PRODUCT_MODEL_ID);
  });

  it('no retired profile is still in the selector', () => {
    // The two lists are disjoint by definition. If someone returns a model to the selector by
    // copying its profile instead of moving it, there are two sources left to drift apart.
    const inSelector = new Set(MODEL_PROFILES.map((p) => p.id));
    for (const profile of RETIRED_PROFILES) expect(inSelector.has(profile.id)).toBe(false);
  });

  it('retired profiles still point at an implemented provider', () => {
    // This is what makes the promise true that offering them again is moving one entry. If someone
    // deletes a provider module, this test falls before the promise does.
    for (const profile of RETIRED_PROFILES) {
      expect(getProvider(profile.provider).id).toBe(profile.provider);
    }
  });
});

describe('Gemini quota error', () => {
  // Real payload captured from the API after exceeding the free tier's limit.
  const REAL_QUOTA_ERROR = {
    event_type: 'error',
    error: {
      code: 'quota_exceeded',
      message:
        'You exceeded your current quota, please check your plan and billing details. ' +
        '* Quota exceeded for metric: generativelanguage.googleapis.com/' +
        'generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\n' +
        'Please retry in 29.220629527s.',
    },
  };

  it('tells it apart by code so it can retry instead of aborting the series', () => {
    const event = geminiProvider.readEvent(REAL_QUOTA_ERROR);

    expect(event?.kind).toBe('error');
    expect(event).toMatchObject({ code: 'quota_exceeded' });
  });

  it('extracts from the message how many seconds to wait, rounding up', () => {
    const event = geminiProvider.readEvent(REAL_QUOTA_ERROR);

    // Using the figure the API gives avoids inventing an arbitrary backoff.
    expect(event).toMatchObject({ retryAfterSeconds: 30 });
  });

  it('an error with no suggested wait does not invent one', () => {
    const event = geminiProvider.readEvent({
      event_type: 'error',
      error: { message: 'something broke' },
    });

    expect(event).toMatchObject({ kind: 'error', retryAfterSeconds: undefined });
  });
});

/**
 * The OpenAI dialect covers TWO providers in the selector (OpenAI and Groq) and, the day there is an
 * endpoint, the model we host ourselves (ADR 0008). A mistake here breaks half the selector at once,
 * so what gets tested is the shape the API rejects with 400 and the one that silently returns empty
 * text — which is the expensive failure, because it cannot be seen.
 */
describe('OpenAI-dialect providers (buildRequest)', () => {
  const luna = findModelProfile('gpt-5.6-luna');
  const qwen = findModelProfile('qwen/qwen3.8-27b');

  it('OpenAI and Groq are the same dialect pointing at different URLs', () => {
    const fromOpenai = openaiProvider.buildRequest(inputFor(luna));
    const fromGroq = groqProvider.buildRequest(inputFor(qwen));

    expect(fromOpenai.url).toContain('api.openai.com');
    expect(fromGroq.url).toContain('api.groq.com');
    // Same body shape: if they stop matching, they stopped being the same provider.
    expect(Object.keys(fromOpenai.body).sort()).toEqual(Object.keys(fromGroq.body).sort());
  });

  it('turns reasoning off — it is what decides the mode latency', () => {
    // `gpt-5.6-luna` reasons at `medium` by default: without this, three short fields would be paid
    // for in tens of seconds. It is the same trap as Gemini's `thinking_level`.
    expect(openaiProvider.buildRequest(inputFor(luna)).body.reasoning_effort).toBe('none');
    expect(groqProvider.buildRequest(inputFor(qwen)).body.reasoning_effort).toBe('none');
  });

  it('passes the key as a Bearer, not in the query string', () => {
    const request = openaiProvider.buildRequest(inputFor(luna));

    expect(request.headers.authorization).toBe('Bearer test-key');
    expect(request.url).not.toContain('test-key');
  });

  it('uses max_completion_tokens: max_tokens is deprecated and reasoning models reject it', () => {
    const body = openaiProvider.buildRequest(inputFor(luna)).body;

    expect(body.max_completion_tokens).toBe(luna.maxTokens);
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('asks for the schema with strict, not json_object', () => {
    // `json_object` only guarantees syntactic JSON: field names are left to the model's discretion,
    // and `parseProductReading` would bounce a correct reading for arriving as "producto" instead
    // of "kind". `strict` does constrained decoding: it *cannot* return another shape.
    const { response_format: rf } = openaiProvider.buildRequest(inputFor(luna)).body as {
      response_format: { type: string; json_schema: { schema: unknown; strict: boolean } };
    };

    expect(rf.type).toBe('json_schema');
    expect(rf.json_schema.strict).toBe(true);
    expect(rf.json_schema.schema).toBe(productSchema);
  });

  it('sends the image as a data URI with its mime type, and uses the prompts it receives', () => {
    const { messages } = openaiProvider.buildRequest(inputFor(luna, { mediaType: 'image/png' }))
      .body as {
      messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[];
    };

    expect(messages[0]).toEqual({ role: 'system', content: PRODUCT_PROMPTS.system });
    const parts = messages[1].content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(parts[0].image_url?.url).toBe('data:image/png;base64,QUJD');
    expect(parts[1].text).toBe(PRODUCT_PROMPTS.user);
  });

  it('asks for token usage in the stream: without stream_options it arrives in no event', () => {
    expect(openaiProvider.buildRequest(inputFor(luna)).body.stream).toBe(true);
    expect(openaiProvider.buildRequest(inputFor(luna)).body.stream_options).toEqual({
      include_usage: true,
    });
  });
});

describe('OpenAI-dialect providers (readEvent)', () => {
  it('reads the incremental text from the delta', () => {
    expect(
      openaiProvider.readEvent({ choices: [{ index: 0, delta: { content: '{"kind"' } }] }),
    ).toEqual({ kind: 'text', text: '{"kind"' });
  });

  it('treats the first delta (role only) as the text start, not as empty text', () => {
    expect(
      openaiProvider.readEvent({ choices: [{ index: 0, delta: { role: 'assistant' } }] }),
    ).toEqual({ kind: 'text-start' });
  });

  it('closes on finish_reason', () => {
    expect(
      openaiProvider.readEvent({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }),
    ).toMatchObject({ kind: 'stop', stopReason: 'stop' });
  });

  it('reads the usage from the final frame, which arrives with empty choices', () => {
    // It is the frame `stream_options.include_usage` enables. If it were dropped for having no
    // choices, token usage would always stay at zero without anything visibly failing.
    expect(
      openaiProvider.readEvent({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 42 } }),
    ).toEqual({ kind: 'stop', usage: { input_tokens: 1200, output_tokens: 42 } });
  });

  it('normalizes the quota error to the code the engine already understands, with the seconds from the message', () => {
    // Using the figure the API gives avoids inventing an arbitrary backoff — the same criterion as
    // with Gemini's "Please retry in 29.2s".
    const event = groqProvider.readEvent({
      error: {
        code: 'rate_limit_exceeded',
        message: 'Rate limit reached for qwen/qwen3.8-27b. Please try again in 1.5s.',
      },
    });

    expect(event).toMatchObject({ kind: 'error', code: 'quota_exceeded', retryAfterSeconds: 2 });
  });

  it('reports the remaining errors without marking them as quota', () => {
    const event = openaiProvider.readEvent({
      error: { code: 'invalid_request_error', message: 'Unsupported parameter' },
    });

    expect(event).toMatchObject({ kind: 'error', code: 'invalid_request_error' });
    expect(event).not.toMatchObject({ code: 'quota_exceeded' });
  });

  it('ignores frames that carry nothing instead of breaking', () => {
    expect(openaiProvider.readEvent({ id: 'chatcmpl-1', object: 'chat.completion.chunk' })).toBeNull();
  });
});
