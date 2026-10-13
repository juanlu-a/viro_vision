/**
 * Translates a provider's HTTP error response into the typed error the UI knows how to read.
 *
 * It exists because of a defect found while measuring against the real API (2026-09-02): quota
 * **does not always arrive as an SSE event**. Groq returns it as **HTTP 429 with a JSON body**,
 * before opening the stream, and down that path `recognizeProduct` threw `VisionHttpError` — which
 * the UI does not distinguish, so the user heard "the cloud did not answer" instead of "quota
 * exhausted, retry in N s". The how-long-to-wait figure was arriving and nobody read it; it is
 * exactly the bug the typed errors of this codebase exist to prevent, repeated on another path.
 *
 * Pure module: it does not touch the network. See httpError.test.ts.
 */
import { VisionHttpError, VisionQuotaError } from './errors';

/** Default wait when the provider does not say how long. Deliberately conservative. */
export const DEFAULT_RETRY_WAIT_S = 30;

/**
 * All three providers put the retry time **inside the message text**, worded differently: Groq and
 * OpenAI say "Please try again in 1.17s", Gemini "Please retry in 29.2s". OpenAI can also give it
 * in milliseconds ("in 20ms"), which rounded down to 0 s would be an immediate retry against a
 * limit that is still active.
 */
const RETRY_IN = /(?:try again|retry) in ([\d.]+)\s*(ms|s)\b/i;

function secondsFromMessage(message: string): number | null {
  const m = RETRY_IN.exec(message);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.ceil(m[2].toLowerCase() === 'ms' ? value / 1000 : value));
}

/** `Retry-After` is the standard and beats the text: it is a number, not a phrase that can change. */
function secondsFromHeader(retryAfter: string | null | undefined): number | null {
  if (!retryAfter) return null;
  const value = Number(retryAfter);
  return Number.isFinite(value) && value >= 0 ? Math.max(1, Math.ceil(value)) : null;
}

interface ErrorBody {
  error?: { message?: unknown; code?: unknown; status?: unknown; type?: unknown };
}

/** All three wrap the detail in `{ error: { message, code } }`, with variations in the rest. */
function readMessage(body: string): { message: string; code: string } {
  try {
    const parsed = JSON.parse(body) as ErrorBody;
    const message = typeof parsed.error?.message === 'string' ? parsed.error.message : body;
    const code = [parsed.error?.code, parsed.error?.status, parsed.error?.type]
      .filter((v): v is string => typeof v === 'string')
      .join(' ');
    return { message, code };
  } catch {
    return { message: body, code: '' };
  }
}

/**
 * `VisionQuotaError` when it is quota —which **resolves by waiting** and is therefore announced
 * differently— and `VisionHttpError` for everything else.
 *
 * The decision is made on **status 429**, not on the provider's code: the 429 is the only thing all
 * three guarantee identically, and the codes differ (`rate_limit_exceeded` in the OpenAI dialect,
 * `RESOURCE_EXHAUSTED` in Gemini). The code is only looked at as reinforcement, for a provider that
 * reports quota with some other status.
 */
export function interpretHttpError(
  status: number,
  body: string,
  retryAfterHeader?: string | null,
): VisionHttpError | VisionQuotaError {
  const { message, code } = readMessage(body);
  const isQuota =
    status === 429 || /rate_limit|quota|resource_exhausted/i.test(code);

  if (!isQuota) return new VisionHttpError(status, body);

  const seconds =
    secondsFromHeader(retryAfterHeader) ??
    secondsFromMessage(message) ??
    DEFAULT_RETRY_WAIT_S;

  return new VisionQuotaError(message, seconds);
}
