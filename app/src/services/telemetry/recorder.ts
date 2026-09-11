/**
 * The telemetry recorder: `record(...)` from anywhere, batched upload to the `telemetry` function
 * (ADR 0008).
 *
 * It exists because on 2026-09-08 the technical information left the screens, and until this landed
 * the diagnosis was nowhere. It is also the only thing that makes it possible to know what happened
 * when the app is used the way it will be used: someone walking with the phone in their pocket, with
 * nobody looking at the screen, who afterwards says "it did not read the sign for me".
 *
 * **BOUNDARY RULE (ADR 0001).** This is network, and therefore FORBIDDEN on the recognition and
 * announcement paths: the linter enforces it for `features/recognition/` and `features/audio/`
 * (`eslint.config.js`). Recording an event can never make a reading or a voice wait. Hence this
 * module's three rules, which are requirements and not style:
 *
 *   1. **`record()` is synchronous and returns no promise.** It enqueues and returns. The caller has
 *      nothing to wait for and cannot forget an `await`.
 *   2. **Nothing here ever throws.** A telemetry failure that took down a reading would be the exact
 *      opposite of what it exists for. Everything is wrapped and the error is swallowed.
 *   3. **Sending is best-effort and fails often, by design.** While the phone is joined to the
 *      device's AP there is WiFi but no internet (ADR 0003): batches will pile up and only upload
 *      once the network is back. The queue has a cap and drops the old (`queue.ts`).
 */
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

import { EventQueue, MAX_PER_BATCH } from './queue';
import { resolveTelemetryUrl } from './config';
import { getPhoneId, generateId } from './identity';
import type { EventType, TelemetryBatch, TelemetryEvent } from './types';

/**
 * ⚠️ `EXPO_PUBLIC_*` is inlined into the bundle at build time. It is a URL, not a secret, so it can
 * travel. The function **requires no authentication** (`verify_jwt = false`, same as the vision
 * proxy): the app has no login and an anon key in the bundle would not be a defence. The worst that
 * can happen is noise in a development table.
 *
 * When our own variable is missing it is **derived from the proxy's** (see `config.ts`): the two
 * functions live in the same project, and without that a build with the proxy but without the new
 * secret would ship with no telemetry at all and nobody would find out until something needed
 * diagnosing.
 */
const defaultUrl = resolveTelemetryUrl(
  process.env.EXPO_PUBLIC_TELEMETRY_URL,
  process.env.EXPO_PUBLIC_VISION_PROXY_URL
);

/** With no URL configured telemetry stays off entirely: it does not enqueue, retry or weigh anything. */
export const isTelemetryConfigured = defaultUrl.length > 0;

/** How often an upload of whatever is pending is attempted. */
const INTERVAL_MS = 15_000;

/** With this many pending, the timer is not waited for: something is going on and it is worth uploading. */
const UPLOAD_THRESHOLD = 25;

/** A hung send cannot hold on to the batch forever. */
const TIMEOUT_MS = 10_000;

/**
 * How many times the SAME batch is retried before giving it up for lost.
 *
 * Without a cap, a batch the server cannot accept —a 500 from a table constraint, say— comes back to
 * the queue, is retried, fails again, and so on until the queue's cap evicts it: meanwhile **no
 * telemetry uploads at all**, because the oldest is always tried first. Which means a single bad
 * event would switch off the whole diagnosis exactly when it is needed. Three attempts are enough
 * for a short network outage and not enough to poison the queue.
 */
const MAX_ATTEMPTS_PER_BATCH = 3;

export interface TelemetryOptions {
  url?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** For tests: without it every assertion would have to wait a real 15 s. */
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel?: (id: ReturnType<typeof setTimeout>) => void;
}

interface State {
  url: string;
  fetchImpl: typeof fetch;
  now: () => Date;
  schedule: NonNullable<TelemetryOptions['schedule']>;
  cancel: NonNullable<TelemetryOptions['cancel']>;
  queue: EventQueue;
  phone: string;
  session: string;
  app: string;
  timer: ReturnType<typeof setTimeout> | null;
  uploading: boolean;
  enabled: boolean;
  /** Consecutive failures of the batch at the front of the queue. See MAX_ATTEMPTS_PER_BATCH. */
  attempts: number;
}

/** App version + platform: without it, comparing two failures is comparing two different builds. */
function describeApp(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const build = Platform.OS === 'ios' ? Constants.platform?.ios?.buildNumber : null;
  return `${version}${build ? `+${build}` : ''} ${Platform.OS}`.slice(0, 64);
}

const state: State = {
  url: defaultUrl,
  fetchImpl: fetch,
  now: () => new Date(),
  schedule: setTimeout,
  cancel: clearTimeout,
  queue: new EventQueue(),
  phone: 'no-id',
  session: generateId('ses'),
  app: '?',
  timer: null,
  uploading: false,
  enabled: false,
  attempts: 0,
};

/**
 * The app state as a string, always. `AppState.currentState` is typed as a union but is whatever
 * the host puts there, and a non-string would be dropped by `JSON.stringify` and leave the field
 * silently missing on exactly the rows that need it.
 */
function currentAppState(): string {
  const value: unknown = AppState.currentState;
  return typeof value === 'string' ? value : 'unknown';
}

/**
 * Enqueues an event. **Synchronous, never throws, waits for nothing.** It is the only function the
 * rest of the app uses.
 */
export function record(type: EventType, extra?: { ms?: number; detail?: Record<string, unknown> }): void {
  if (!state.enabled) return;
  try {
    const event: TelemetryEvent = {
      type,
      at: state.now().toISOString(),
      ...(typeof extra?.ms === 'number' && Number.isFinite(extra.ms) ? { ms: extra.ms } : null),
      // `app` is stamped HERE and not at each call site, because the one call site somebody forgets
      // is going to be the one on the path that matters. The whole point of this table is the phone
      // locked in a pocket (see the module docblock), and without knowing which app state a row was
      // written in, a locked-screen run and a foreground one are the same timeline. It is a
      // synchronous property read and it costs nothing. A caller that passes its own `app` wins.
      detail: { app: currentAppState(), ...extra?.detail },
    };
    state.queue.enqueue(event);
    if (state.queue.length >= UPLOAD_THRESHOLD) void flush();
  } catch {
    // Rule 2: telemetry takes nothing down.
  }
}

/**
 * Uploads one batch. It returns a promise so it can be awaited in tests and when going to the
 * background; **nobody on a reading's path awaits it**.
 */
export async function flush(): Promise<void> {
  if (!state.enabled || state.uploading || state.queue.length === 0) return;
  state.uploading = true;
  const batch = state.queue.takeBatch(MAX_PER_BATCH);
  const dropped = state.queue.droppedCount;
  try {
    // Drops travel with the batch: a silent hole leads to concluding that something did not happen
    // when in fact it could not be recorded.
    if (dropped > 0) {
      batch.push({ type: 'app.error', at: state.now().toISOString(), detail: { droppedEvents: dropped } });
    }
    const body: TelemetryBatch = {
      phone: state.phone,
      session: state.session,
      app: state.app,
      events: batch,
    };
    const controller = new AbortController();
    const timer = state.schedule(() => controller.abort(), TIMEOUT_MS);
    try {
      const r = await state.fetchImpl(state.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      state.queue.clearDropped();
      state.attempts = 0;
    } finally {
      state.cancel(timer);
    }
  } catch {
    state.attempts += 1;
    if (state.attempts >= MAX_ATTEMPTS_PER_BATCH) {
      // The server is never going to accept this batch. It is given up for lost —counted, so the
      // hole is visible— and the queue moves on to what comes next, which is what matters.
      state.queue.drop(batch.length);
      state.attempts = 0;
    } else {
      // With no internet (the normal case on the device's AP) the batch returns to the queue and waits.
      state.queue.returnBatch(batch);
    }
  } finally {
    state.uploading = false;
  }
}

function scheduleNextUpload(): void {
  if (!state.enabled || state.timer) return;
  state.timer = state.schedule(() => {
    state.timer = null;
    void flush().finally(scheduleNextUpload);
  }, INTERVAL_MS);
}

/**
 * Starts telemetry. Called exactly once, from the root layout.
 *
 * It also hooks React Native's global error handler: **a crash is the most useful event this table
 * can hold**, and it is precisely the one no `try` in the app is going to record. It chains to the
 * previous handler so nobody loses the development red screen.
 */
export function startTelemetry(options: TelemetryOptions = {}): () => void {
  const url = options.url ?? defaultUrl;
  if (url.length === 0) return () => {};

  state.url = url;
  state.fetchImpl = options.fetchImpl ?? fetch;
  state.now = options.now ?? (() => new Date());
  state.schedule = options.schedule ?? setTimeout;
  state.cancel = options.cancel ?? clearTimeout;
  state.app = describeApp();
  state.enabled = true;

  // The phone id comes from disk: the events of the first few milliseconds are enqueued with the
  // placeholder and corrected here. It is not awaited, so startup is not delayed.
  void getPhoneId().then((id) => {
    state.phone = id;
  });

  const previous = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler?.((error, fatal) => {
    record('app.error', {
      detail: {
        fatal: Boolean(fatal),
        name: error?.name ?? null,
        message: String(error?.message ?? error).slice(0, 500),
        // The stack trimmed: with an 8 KB cap for ALL of the detail, a whole one takes the event with it.
        stack: String(error?.stack ?? '').slice(0, 2_000),
      },
    });
    // Fatal = the app is going away. It is the last chance for the crash to reach the table.
    void flush();
    previous?.(error, fatal);
  });

  // The two edges of the pocket. Going away is the obvious one: the user put the phone down and the
  // app may stay suspended for a good while, so whatever is queued has to leave now. Coming back is
  // the one that was missing until 2026-09-10, and it is the one that matters most: a whole reading
  // can happen with the screen locked, and its rows only reach the table if something drains the
  // queue. Until then that depended on a 15 s timer outliving the suspension, which is exactly the
  // thing that cannot be assumed about a background run.
  const subscription = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      record('app.foreground');
      void flush();
      return;
    }
    record('app.background', { detail: { state: next } });
    void flush();
  });

  scheduleNextUpload();

  return () => {
    state.enabled = false;
    if (state.timer) state.cancel(state.timer);
    state.timer = null;
    subscription.remove();
    if (previous) ErrorUtils.setGlobalHandler?.(previous);
  };
}

/** Tests only: leaves the module as freshly loaded. */
export function resetTelemetryForTests(): void {
  state.queue = new EventQueue();
  state.timer = null;
  state.uploading = false;
  state.enabled = false;
  state.attempts = 0;
  state.phone = 'no-id';
}
