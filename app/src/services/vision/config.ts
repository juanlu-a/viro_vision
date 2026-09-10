/**
 * Cloud vision configuration (supermarket mode, ADR 0006 + ADR 0008), read from public env vars
 * (see app/.env.example).
 *
 * ⚠️ `EXPO_PUBLIC_*` vars are inlined into the bundle at build time: a build compiled without a key
 * cannot recover it at runtime and —the other way around— a build compiled WITH a key carries it
 * readable inside the `.ipa`. That is why the keys' destination is the ADR 0008 proxy; this direct
 * path stays as the development one, against a local `.env`.
 *
 * When there is no key at all, supermarket mode says it is not configured instead of breaking —
 * the same pattern as the Supabase stub.
 */
import { isProxyConfigured } from '@/services/cloud';

import type { ModelProfile, VisionProviderId } from './types';

/** Gemini: free tier with no card (aistudio.google.com). It is the mode's default. */
export const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

/** OpenAI: requires credit with a card. */
export const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

/** Anthropic: requires credit with a card (a Claude subscription does NOT enable the API). */
export const anthropicApiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

/** Groq: free tier with no card (console.groq.com). */
export const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';



const API_KEYS: Record<VisionProviderId, string> = {
  gemini: geminiApiKey,
  openai: openaiApiKey,
  anthropic: anthropicApiKey,
  groq: groqApiKey,
};

export const isGeminiConfigured = geminiApiKey.length > 0;
export const isOpenaiConfigured = openaiApiKey.length > 0;
export const isAnthropicConfigured = anthropicApiKey.length > 0;
export const isGroqConfigured = groqApiKey.length > 0;

export function apiKeyFor(provider: VisionProviderId): string {
  return API_KEYS[provider];
}

/**
 * With the proxy on, **every** provider is available even when the build ships no key at all:
 * precisely because the server holds them. Without this, a correct build —the one we want to
 * distribute— would show supermarket mode as "not configured".
 *
 * Whether the server holds a given provider's secret cannot be known from here; if it is missing,
 * the function answers 503 naming the missing secret.
 */
export function isProviderConfigured(provider: VisionProviderId): boolean {
  return isProxyConfigured || apiKeyFor(provider).length > 0;
}

/** With no proxy and no key at all, supermarket mode cannot read: the UI says so instead of failing. */
export const isVisionConfigured =
  isProxyConfigured || (Object.keys(API_KEYS) as VisionProviderId[]).some(isProviderConfigured);

export const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export const ANTHROPIC_VERSION = '2023-06-01';

export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/** Groq exposes the OpenAI dialect under `/openai/v1`, on its own host. */
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * The models the Home selector offers (only those whose provider has a key). The order is the
 * selector's order.
 *
 * **They are chosen by measured latency, not by capability or catalogue**: the user is standing in
 * front of the shelf waiting to hear what they picked up, and the reading is three short fields
 * that do not need a large model. The numbers backing this list are in
 * `docs/mediciones/2026-09-02-modelos-supermercado.md`.
 *
 * **There are two, and that is deliberate.** The selector is a `radiogroup` walked with VoiceOver:
 * every extra option is one more swipe between the person and the reading. Two options cover the
 * real choice that exists —the balanced one without a tight quota, and the fastest one with a tight
 * quota— and any third would have to be justified against that cost.
 *
 * **What left, and why it can come back.** `gemini-3.5-flash-lite` (the default until 2026-09-02)
 * left over the measurement: 10 649 ms median and a 2820-32 586 ms range, against 1668 ms for the
 * current default. `claude-haiku-4-5` left for being unverified and keyless; `gemini-flash-lite-latest`
 * and `claude-opus-5` had left on 2026-09-01 over the accessibility cost of a long selector. **Their
 * providers' modules are still here** (`providers/gemini.ts`, `providers/anthropic.ts`), verified
 * and with their findings commented: offering one again is adding its profile to this list, not
 * rewriting code.
 *
 * The model hosted at Arnaldo Castro is decided but **not implemented**: the endpoint is missing
 * (ADR 0008).
 */
export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    // Default since 2026-09-02. It is not the fastest —Groq is— but **the fastest one that survives
    // a walk down the aisle**: Groq's free quota is ~4 readings per minute and someone picking
    // products makes on the order of 2 to 4, so as a default it would hit the limit.
    //
    // Measured against the real API (5 runs, 2026-09-02): 1668 ms median, 1410-2490 ms range, with
    // kind, brand and detail correct in all of them. It costs ~USD 0.0003 per reading (1138 input
    // tokens + 35 output): a thousand readings, under half a dollar.
    //
    // It is a reasoning model and its default is `medium`. It is sent `reasoning_effort: 'none'` out
    // of intent, not for latency: the measurement showed it makes no difference on this task (see
    // `providers/openaiCompatible.ts`).
    provider: 'openai',
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna (equilibrado)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // The fastest of those measured and the only free-without-a-card one left: 846 ms median,
    // 764-1087 ms range — half the default's and with less spread. It is not the default because of
    // the quota: the free tier limits by **tokens** per minute (8000 TPM) and a photo costs ~1974
    // fixed, i.e. ~4 readings per minute. Shrinking the image does not lower it: Groq bills it flat.
    //
    // The interest for the thesis is not that it is another large model but **another kind of
    // hardware**: Groq's LPUs against the proprietary vendors' GPUs. That an open 27B model beats
    // them 2x on latency is a reportable result.
    //
    // It is the 3.8 and not the 3.6, even though the latter is faster on paper (500 vs 450 tok/s):
    // the 3.6 only supports `json_object`, which guarantees syntactic JSON but leaves field names to
    // the model's discretion, and `parseProductReading` would bounce a correct reading for arriving
    // as "producto" instead of "kind". The 3.8 supports `json_schema` with `strict`. Both are in
    // preview.
    provider: 'groq',
    id: 'qwen/qwen3.8-27b',
    label: 'Qwen 3.8 27B en Groq (el más rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
];

/**
 * Profiles **retired from the selector**, whose providers are still implemented and tested.
 *
 * This is neither dead code nor nostalgia: `providers/gemini.ts` and `providers/anthropic.ts` are
 * still in the binary, with their findings commented (Gemini's `event_type` discriminator, Haiku's
 * 400 on `output_config.effort`), and their tests need a profile to build a request against. Having
 * them here makes **offering one again a matter of moving an entry into `MODEL_PROFILES`**, instead
 * of rewriting a profile from memory and losing the measurement that describes it along the way.
 *
 * `findModelProfile` deliberately does **not** look them up: a retired id has to fall back to the
 * default, which is what `resolveProductModel` does with the stored preference of someone who chose
 * a model that is no longer there.
 */
export const RETIRED_PROFILES: readonly ModelProfile[] = [
  {
    // It was the default until 2026-09-02. It leaves over the measurement against the real API:
    // 10 649 ms median with a 2820 to 32 586 ms range, against 1668 ms for the current default.
    // What rules it out is not the median but the spread — 11.6x between best and worst case, with a
    // fresh quota and spaced-out runs. It keeps the best quota of the three (20/min) and the worst
    // latency, so if some day quota mattered more than time, it is the candidate.
    provider: 'gemini',
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // It never got verified against its API: it requires a card and there was no key. It does not
    // leave for being bad, it leaves for being unknown — it is the third model family and remains
    // the point of comparison ADR 0006 wanted.
    provider: 'anthropic',
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
];

/** Only the models whose provider has a key loaded. */
export function availableModels(): readonly ModelProfile[] {
  return MODEL_PROFILES.filter((profile) => isProviderConfigured(profile.provider));
}

/** The first usable model, or the first in the registry when there is no key at all. */
export function defaultModel(): ModelProfile {
  return availableModels()[0] ?? MODEL_PROFILES[0];
}

export function findModelProfile(id: string): ModelProfile {
  return MODEL_PROFILES.find((profile) => profile.id === id) ?? defaultModel();
}
