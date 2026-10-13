/**
 * Exists because the Home model selector only makes sense if ALL providers get the same prompt and
 * the same schema: if one provider's request drifted, picking another model would change the
 * question and the comparison would measure prompts, not models — without anyone noticing.
 * It also pins that the declared default is the one actually used: `PRODUCT_MODEL` resolves the id
 * with a fallback to the first in the registry, and that fallback would silently cover for an id
 * that no longer exists — the app would read with a model other than the one the constant names,
 * and the measurement justifying the default would be describing a different one (ADR 0006,
 * measurement of 2026-09-02).
 */
import {
  ANTHROPIC_MESSAGES_URL,
  GEMINI_INTERACTIONS_URL,
  MODEL_PROFILES,
  RETIRED_PROFILES,
} from './config';
import {
  DEFAULT_PRODUCT_MODEL_ID,
  PRODUCT_MODEL,
  PRODUCT_PROMPTS,
  buildProductRequest,
  parseProductReading,
  productSchema,
} from './product';
import { PRODUCT_SYSTEM_PROMPT, PRODUCT_USER_PROMPT } from './providers/prompts';

describe('parseProductReading', () => {
  it('accepts the requested shape: kind and brand separate, not a single name', () => {
    expect(
      parseProductReading('{"kind": "arroz", "brand": "Saman", "detail": "Blue Patna 1 kg"}'),
    ).toEqual({ kind: 'arroz', brand: 'Saman', detail: 'Blue Patna 1 kg' });
  });

  it('accepts null in any field: an unreadable package has to be able to say so', () => {
    expect(parseProductReading('{"kind": null, "brand": null, "detail": null}')).toEqual({
      kind: null,
      brand: null,
      detail: null,
    });
  });

  it('tolerates a code-block wrapper', () => {
    expect(parseProductReading('```json\n{"kind": "yerba", "brand": "Canarias", "detail": null}\n```')).toEqual({
      kind: 'yerba',
      brand: 'Canarias',
      detail: null,
    });
  });

  it('rejects truncated JSON or another shape', () => {
    expect(parseProductReading('{"kind": "arro')).toBeNull();
    expect(parseProductReading('{"producto": "the old key, from before kind and brand were split"}')).toBeNull();
    expect(parseProductReading('{"kind": 42, "brand": null, "detail": null}')).toBeNull();
    expect(parseProductReading('')).toBeNull();
  });
});

describe('buildProductRequest', () => {
  const input = { apiKey: 'test-key', imageBase64: 'aW1hZ2Vu', mediaType: 'image/jpeg' as const };

  /**
   * Gemini and Anthropic left the selector on 2026-09-02, but their providers are still in the
   * binary: what these two cases verify is not that the model is offered, it is that the prompt and
   * the schema are the SAME for every dialect. If they stopped being so, comparing models would
   * measure prompts.
   */
  const retired = (id: string) => RETIRED_PROFILES.find((p) => p.id === id)!;

  it('with a Gemini model it builds the Interactions API request with the product prompt and schema', () => {
    const request = buildProductRequest({ ...input, model: retired('gemini-3.5-flash-lite') });
    const body = request.body as {
      model: string;
      input: { type: string; text?: string }[];
      response_format: { schema: unknown };
    };

    expect(request.url).toBe(GEMINI_INTERACTIONS_URL);
    expect(body.model).toBe('gemini-3.5-flash-lite');
    expect(body.input.filter((b) => b.type === 'text').map((b) => b.text)).toEqual([
      PRODUCT_SYSTEM_PROMPT,
      PRODUCT_USER_PROMPT,
    ]);
    expect(body.response_format.schema).toBe(productSchema);
  });

  it('with an Anthropic model it builds the Messages API request with the SAME prompt and schema', () => {
    const request = buildProductRequest({ ...input, model: retired('claude-haiku-4-5') });
    const body = request.body as {
      model: string;
      system: string;
      output_config: { format: { schema: unknown } };
    };

    expect(request.url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.system).toBe(PRODUCT_PROMPTS.system);
    expect(body.output_config.format.schema).toBe(productSchema);
  });

  it('the resolved default is the one DEFAULT_PRODUCT_MODEL_ID declares, and it is in the selector', () => {
    // `PRODUCT_MODEL` resolves the id against the registry with a fallback to the first one. If the
    // id stopped existing, the fallback would silently cover for it and the app would read with a
    // model other than the one the constant names — with the measurement justifying the default
    // pointing at the wrong one.
    expect(PRODUCT_MODEL.id).toBe(DEFAULT_PRODUCT_MODEL_ID);
    expect(MODEL_PROFILES.some((p) => p.id === DEFAULT_PRODUCT_MODEL_ID)).toBe(true);
  });

  it('the product schema meets what both APIs demand', () => {
    expect(productSchema.required).toEqual(['kind', 'brand', 'detail']);
    expect(productSchema.additionalProperties).toBe(false);
  });
});
