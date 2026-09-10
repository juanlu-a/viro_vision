/**
 * The contract shared by everything that leaves the app for the cloud.
 *
 * It lives outside `services/vision/` because the ADR 0008 proxy is not about vision: speech
 * synthesis (`services/audio/synthesis.ts`) goes out the same way, and making it depend on
 * `services/vision` would be an invented dependency between two things that only share transport.
 */

/**
 * The providers the proxy knows how to reach. **This list has to match the `PROVIDERS` table in
 * `supabase/functions/vision/index.ts`**: they are two files that share no code —one runs on Hermes
 * and the other on Deno— and if they drift apart the proxy answers 400 and from the phone there is
 * no way to see why.
 */
export type CloudProviderId = 'gemini' | 'anthropic' | 'openai' | 'groq';

/** An HTTP request already built, ready to go out directly or to be wrapped in the proxy envelope. */
export interface CloudRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}
