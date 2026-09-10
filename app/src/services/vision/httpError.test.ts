/**
 * Exists because of a real defect found while measuring against the API (2026-09-02): Groq's quota
 * arrives as **HTTP 429 with a JSON body**, not as an SSE event, and down that path the user heard
 * "the cloud did not answer" instead of "quota exhausted, retry in N s" — with the how-long-to-wait
 * figure arriving and nobody reading it. The payloads below are the real ones, not invented from the
 * docs: the wording of the retry time changes between providers and it is what is being parsed.
 */
import { VisionHttpError, VisionQuotaError } from './errors';
import { DEFAULT_RETRY_WAIT_S, interpretHttpError } from './httpError';

/** Captured from the real API on 2026-09-02, exhausting Groq's tokens-per-minute limit. */
const GROQ_QUOTA = JSON.stringify({
  error: {
    message:
      'Rate limit reached for model `qwen/qwen3.8-27b` in organization `org_01m1` service tier ' +
      '`on_demand` on tokens per minute (TPM): Limit 8000, Used 5670, Requested 2486. ' +
      'Please try again in 1.17s. Need more tokens? Upgrade to Dev Tier today.',
    type: 'tokens',
    code: 'rate_limit_exceeded',
  },
});

describe('interpretHttpError', () => {
  it('turns Groq\'s 429 into a quota error, with the seconds from the message', () => {
    const err = interpretHttpError(429, GROQ_QUOTA);

    expect(err).toBeInstanceOf(VisionQuotaError);
    expect((err as VisionQuotaError).retryAfterSeconds).toBe(2); // 1.17 s rounded up
  });

  it('understands Gemini\'s wording, which says "retry" and not "try again"', () => {
    const err = interpretHttpError(
      429,
      JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Please retry in 29.22s.' } }),
    );

    expect(err).toBeInstanceOf(VisionQuotaError);
    expect((err as VisionQuotaError).retryAfterSeconds).toBe(30);
  });

  it('never returns 0 seconds when the provider answers in milliseconds', () => {
    // OpenAI can say "in 20ms". Rounded down to 0 s it would retry immediately against a limit that
    // is still active, and the retry fails again.
    const err = interpretHttpError(
      429,
      JSON.stringify({ error: { message: 'Rate limit reached. Please try again in 20ms.', code: 'rate_limit_exceeded' } }),
    );

    expect((err as VisionQuotaError).retryAfterSeconds).toBe(1);
  });

  it('the Retry-After header beats the message text', () => {
    // It is a number and not a phrase: it does not break if the provider rewrites the message.
    const err = interpretHttpError(429, GROQ_QUOTA, '7');

    expect((err as VisionQuotaError).retryAfterSeconds).toBe(7);
  });

  it('when the 429 does not say how long to wait, it uses the default instead of retrying now', () => {
    const err = interpretHttpError(429, JSON.stringify({ error: { message: 'Too many requests' } }));

    expect((err as VisionQuotaError).retryAfterSeconds).toBe(DEFAULT_RETRY_WAIT_S);
  });

  it('recognizes quota by its code even when the status is not 429', () => {
    const err = interpretHttpError(
      403,
      JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }),
    );

    expect(err).toBeInstanceOf(VisionQuotaError);
  });

  it('any other error stays a VisionHttpError, with the body intact', () => {
    // The whole body is kept because it is the only thing that says which parameter the API rejected.
    const body = JSON.stringify({ error: { message: 'Unsupported parameter: max_tokens' } });
    const err = interpretHttpError(400, body);

    expect(err).toBeInstanceOf(VisionHttpError);
    expect((err as VisionHttpError).status).toBe(400);
    expect((err as VisionHttpError).body).toBe(body);
  });

  it('does not break on a body that is not JSON (a proxy HTML page, for instance)', () => {
    const err = interpretHttpError(502, '<html>Bad Gateway</html>');

    expect(err).toBeInstanceOf(VisionHttpError);
  });
});
