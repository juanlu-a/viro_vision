/**
 * Per-model rate limiter with a sliding window.
 *
 * Gemini's free tier allows 20 requests per minute **per model**. Reacting to the quota error works
 * but is a bad experience: supermarket mode stalls for 30-60 s with no warning. Here the limit is
 * honoured *before* asking, so in the worst case the app waits a while with a clear message and
 * never fails.
 *
 * It uses `Date.now()` on purpose, not `performance.now()`: the quota window is wall-clock time on
 * the server side, not a measured duration.
 */
import type { VisionProviderId } from './types';

/** The quota window. */
const WINDOW_MS = 60_000;

/**
 * Per-minute, per-model cap, **by provider**.
 *
 * There used to be a single number, 17, calibrated to Gemini's free tier. Imposing it on a paid
 * provider wastes exactly the reason for paying: it puts the most restricted one's ceiling on the
 * one that has none.
 *
 * The two free ones carry headroom over the real limit, to cover requests the server already
 * counted and we did not (a retry of its own, a run aborted mid-flight). The paid ones carry a high
 * number on purpose: there the limiter **stops being the free tier's wall and becomes a safety cap**
 * against a runaway loop burning credit. A paid account's real limit depends on its tier and cannot
 * be known from here.
 */
const LIMIT_PER_PROVIDER: Record<VisionProviderId, number> = {
  gemini: 17, // 20/min per model on the free tier, measured 2026-08-30
  // CAREFUL: Groq's free tier limits by **tokens** per minute, not by requests. Measured
  // 2026-09-02: the limit is 8000 TPM and a photo costs ~1974 input tokens (Groq bills the image
  // at a flat rate, so shrinking it does not lower that), i.e. **~4 readings per minute**. The 25
  // that used to be here was the number for a request-based limit this provider does not have, and
  // it meant the limiter never braked: the third reading in a row already returned 429.
  groq: 3,
  openai: 100, // far above what anyone does by hand: an emergency brake, not a quota
  anthropic: 40,
};

/** The default cap when nothing else is said: the most restrictive one, which never breaks. */
const MAX_PER_WINDOW = LIMIT_PER_PROVIDER.gemini;

/** How many readings per minute a provider tolerates. `recognizeProduct` passes it when asking for a slot. */
export function perMinuteLimit(provider: VisionProviderId): number {
  return LIMIT_PER_PROVIDER[provider];
}

/** Timestamps of recent sends, per model: each model has its own quota. */
const sends = new Map<string, number[]>();

export interface SlotOptions {
  /** Called when a wait is needed, with the estimated milliseconds. So the UI can announce it. */
  onWait?: (waitMs: number) => void;
  signal?: AbortSignal;
  /** Injectable clock for tests. */
  now?: () => number;
  maxPerWindow?: number;
  /** Injectable wait for tests: otherwise a window test would take a real minute. */
  sleep?: (ms: number) => Promise<void>;
}

/** Sleeps `ms`, or cuts short when the run is cancelled. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    });
  });
}

/** Drops the timestamps that already left the window. */
function prune(modelId: string, now: number): number[] {
  const recent = (sends.get(modelId) ?? []).filter((t) => now - t < WINDOW_MS);
  sends.set(modelId, recent);
  return recent;
}

/**
 * Waits, if needed, until there is room in the window; then records the send.
 * Call it **before** taking the start timestamp: the wait must not be counted as latency.
 */
export async function acquireSlot(modelId: string, options: SlotOptions = {}): Promise<void> {
  const now = options.now ?? (() => Date.now());
  const max = options.maxPerWindow ?? MAX_PER_WINDOW;

  const sleep = options.sleep ?? ((ms: number) => delay(ms, options.signal));

  for (;;) {
    // First of all: if it is already cancelled, there is no point asking for a slot or waiting for
    // one. Without this check, a signal aborted *before* reaching here would sleep the whole
    // minute, because the 'abort' event already fired and `delay`'s listener never triggers.
    if (options.signal?.aborted) return;

    const t = now();
    const recent = prune(modelId, t);
    if (recent.length < max) {
      recent.push(t);
      sends.set(modelId, recent);
      return;
    }

    // We have to wait for the oldest timestamp to leave the window.
    const waitMs = WINDOW_MS - (t - recent[0]) + 250;
    options.onWait?.(waitMs);
    await sleep(waitMs);
  }
}

/** How many sends remain available in the current window. To show it in the UI. */
export function remainingSlots(
  modelId: string,
  now: number = Date.now(),
  maxPerWindow: number = MAX_PER_WINDOW,
): number {
  return Math.max(0, maxPerWindow - prune(modelId, now).length);
}

/** Tests only: forget the history. */
export function resetRateLimiter(): void {
  sends.clear();
}
