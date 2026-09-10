/**
 * Supermarket product reading: type, schema, prompts and request building (ADR 0006).
 * Pure module: no network, no state. See product.test.ts; the network call lives in
 * recognizeProduct.ts.
 *
 * Since 2026-08-30 the cloud IS the supermarket path (the user is standing still and trades
 * latency for accuracy); the user picks the model on Home. Prompt and schema are shared by every
 * provider: that way switching models compares models, not questions.
 */
import { MODEL_PROFILES } from './config';
import { getProvider } from './providers';
import { PRODUCT_SYSTEM_PROMPT, PRODUCT_USER_PROMPT } from './providers/prompts';
import { parseJsonRecord } from './schema';
import type { ModelProfile, ProviderRequest, TaskPrompts } from './types';

/**
 * Only what the voice announcement needs, in three SEPARATE fields: `kind` is what it is (arroz,
 * harina, fideos…), `brand` whose it is, and `detail` the variety/flavour/presentation (the
 * optional label-OCR goal fits here).
 *
 * Kind and brand are separate rather than one name because they are two data points with different
 * priorities for someone who cannot see: the kind decides whether the product is useful at all, the
 * brand only which of the useful ones. Separated, the announcement can say the kind even when the
 * brand cannot be read (and the other way around), instead of losing both to one field the model
 * could not fill in completely.
 */
export interface ProductReading {
  kind: string | null;
  brand: string | null;
  detail: string | null;
}

/**
 * Schema for structured outputs. Constraints both APIs demand: complete `required`,
 * `additionalProperties: false`, no `minLength` and no numeric constraints.
 * All three fields accept null: an unreadable package has to be able to say so, not invent.
 */
export const productSchema = {
  type: 'object',
  properties: {
    kind: { type: ['string', 'null'] },
    brand: { type: ['string', 'null'] },
    detail: { type: ['string', 'null'] },
  },
  required: ['kind', 'brand', 'detail'],
  additionalProperties: false,
} as const;

export const PRODUCT_PROMPTS: TaskPrompts = {
  system: PRODUCT_SYSTEM_PROMPT,
  user: PRODUCT_USER_PROMPT,
};

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Parses and validates the model's answer; null on invalid JSON or an unexpected shape. */
export function parseProductReading(text: string): ProductReading | null {
  const candidate = parseJsonRecord(text);
  if (!candidate) return null;

  if (!isStringOrNull(candidate.kind)) return null;
  if (!isStringOrNull(candidate.brand)) return null;
  if (!isStringOrNull(candidate.detail)) return null;

  return { kind: candidate.kind, brand: candidate.brand, detail: candidate.detail };
}

/**
 * The default when the user has chosen nothing.
 *
 * It is not the fastest measured one —`qwen/qwen3.8-27b` is, by almost 2x— but **the fastest one
 * that survives a walk down the aisle**: Groq's free quota is ~4 readings per minute and someone
 * picking products makes on the order of 2 to 4. A default that hits the limit on the fourth
 * reading is a worse product than one 800 ms slower.
 *
 * It used to be `gemini-3.5-flash-lite`. It changed on 2026-09-02 with the measurement against the
 * real APIs: Gemini gave a 10 649 ms median with a 2820-32 586 ms range, and what rules it out is
 * not the median but the spread — for someone waiting on the audio, a model that sometimes takes
 * half a minute is worse than one that always takes under two seconds. See
 * `docs/mediciones/2026-09-02-modelos-supermercado.md`.
 */
export const DEFAULT_PRODUCT_MODEL_ID = 'gpt-5.6-luna';

/** The default resolved against the registry, so consumers do not repeat the `find`. */
export const PRODUCT_MODEL: ModelProfile =
  MODEL_PROFILES.find((profile) => profile.id === DEFAULT_PRODUCT_MODEL_ID) ?? MODEL_PROFILES[0];

/**
 * Builds the product-reading request for the given model, delegating to its provider.
 * `thinking: 'off'` even when the model supports adaptive: the answer is three short fields and on
 * the free tier reasoning multiplies tokens and latency. If accuracy turns out to be short, it is
 * a knob.
 */
export function buildProductRequest(input: {
  model: ModelProfile;
  apiKey: string;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
}): ProviderRequest {
  return getProvider(input.model.provider).buildRequest({
    model: input.model,
    apiKey: input.apiKey,
    maxTokens: input.model.maxTokens,
    thinking: 'off',
    effort: 'low',
    imageBase64: input.imageBase64,
    mediaType: input.mediaType,
    prompts: PRODUCT_PROMPTS,
    schema: productSchema,
  });
}
