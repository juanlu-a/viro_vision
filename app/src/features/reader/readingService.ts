/**
 * The reading pipeline, by operating mode (ADR 0007): idle, bus, supermarket.
 *
 * **Why this is a module and not a hook.** Until 2026-09-10 all of this lived inside `useReader`,
 * which only Home mounts, and the device's button reached it as React state:
 * `onReadRequest` → `setReadRequest(n + 1)` → context → `useEffect`. That made a hardware interrupt
 * depend on which tab is on screen and on a render being scheduled and committed. On a phone the
 * user is holding, that works. On a phone locked in a pocket —which is the entire product (ADR 0003
 * §2)— it is a chain of assumptions we cannot audit inside the few seconds iOS grants when it wakes
 * the app for a BLE notification. So the button now calls straight into this module, and React
 * subscribes to it (`useReader`) instead of carrying it.
 *
 * The second reason is just as practical: the audio session has to be taken **before the first
 * await** of a reading (`services/audio/session.ts`), and a React round-trip makes that impossible
 * to guarantee.
 *
 * Each mode keeps its own pipeline (ADR 0006). **Bus always runs locally**: OCR over the banner — in
 * the product the device's TPU crops it; today, with no hardware, over the whole photo — because out
 * on the street latency rules and signal is not guaranteed. **Supermarket goes to the cloud**, to
 * the vision model the user picked in Settings: they are standing still and trade latency for
 * accuracy. With no internet or no key, supermarket **says so** and does not read.
 *
 * The image ALWAYS comes from the device's camera (ADR 0003: the photo comes down over WiFi, BLE is
 * the control plane).
 *
 * Every mode transition and every result is **announced by voice**: this is an app for people who do
 * not see the screen. What stays on screen is the result, nothing else: the timings, which model
 * answered and the raw text go to telemetry, not to the interface.
 */
import { AppState } from 'react-native';

import { announce } from '@/features/audio/announcer';
import { decideDelivery, getAudioOutput } from '@/features/audio/audioOutput';
import { guessBusReading, phraseBusReading, phraseProduct } from '@/features/reader/reading';
import type { BusReading } from '@/features/reader/reading';
import { requestsReading, transition } from '@/features/reader/modes';
import type { Gesture, Mode } from '@/features/reader/modes';
import { strings } from '@/i18n';
import { beginReadingAudio, endReadingAudio, playStartEarcon } from '@/services/audio/session';
import { isSynthesisEnabled, synthesizeToFile } from '@/services/audio/synthesis';
import { flush, record } from '@/services/telemetry';
import { HttpDownloadError } from '@/services/wifi/deviceHttp';
import type { CloudImage, DevicePhoto } from '@/services/camera';
import { loadOcr, readImage, isOcrLoaded } from '@/services/ondevice';
import {
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  recognizeProduct,
} from '@/services/vision';
import type { ModelProfile, ProductReading } from '@/services/vision';

const t = strings.reader;

const MODE_ANNOUNCEMENT: Record<Mode, string> = {
  idle: t.announceIdle,
  bus: t.announceBus,
  supermarket: t.announceSupermarket,
};

/**
 * How long a whole reading may take before it is given up.
 *
 * It exists because of the locked screen. iOS hands the app a few seconds when a BLE notification
 * wakes it; the keep-alive tone buys more, but not forever, and a reading that runs past the point
 * where the process is killed is a reading the user never hears **and** never learns about. Better
 * to fail out loud. Twelve seconds is four times the measured median cycle (~3 s, ADR 0003) and
 * still short enough that the user does not stand in front of a shelf wondering.
 */
export const READING_DEADLINE_MS = 12_000;

/** The photo cannot have the whole budget: 4 s is ~80× the measured 46 ms over the device's AP. */
const PHOTO_TIMEOUT_MS = 4_000;

export interface ReaderState {
  mode: Mode;
  status: 'idle' | 'preparing' | 'reading';
  message: string;
  /** Fraction 0-1 while the OCR downloads its model for the first time. */
  progress: number | null;
  reading: BusReading | null;
  product: ProductReading | null;
  /**
   * The photo the device took for the last reading, so it can be shown. It is the product's own
   * content and not diagnostics: whoever has some sight uses it to check what the camera framed,
   * and it is the only way to tell "the model was wrong" from "the photo was of the ceiling".
   */
  photoUri: string | null;
}

const initialState: ReaderState = {
  mode: 'idle',
  status: 'idle',
  message: '',
  progress: null,
  reading: null,
  product: null,
  photoUri: null,
};

/**
 * What the reading needs from the rest of the app.
 *
 * They are **getters and not values**: the deps are installed once, at mount, and each one is
 * resolved at the instant of the reading. That is what lets a plain module see the model the user
 * chose in Settings a minute ago without React having to re-register anything — and it is the same
 * guarantee `ProductModelProvider` exists to give, one layer down.
 */
export interface ReaderDeps {
  getModel(): ModelProfile | null;
  downloadPhoto(options?: { timeoutMs?: number }): Promise<DevicePhoto>;
  sendAudio(uri: string): Promise<boolean>;
  writeMode(mode: Mode): Promise<void>;
  /**
   * Whether the device can receive audio right now (connected, on its network, answering). Asked
   * BEFORE synthesizing: the synthesis is a paid cloud call, and spending it on audio that has
   * nowhere to go is worse than checking first.
   */
  isDeviceReady(): boolean;
}

const noDeps: ReaderDeps = {
  getModel: () => null,
  downloadPhoto: () => Promise.reject(new Error(strings.connect.noAddress)),
  sendAudio: () => Promise.resolve(false),
  writeMode: () => Promise.resolve(),
  isDeviceReady: () => false,
};

let deps: ReaderDeps = noDeps;
let state: ReaderState = initialState;
let reading = false;
const listeners = new Set<() => void>();

export function configureReader(next: ReaderDeps): void {
  deps = next;
}

export function getReaderState(): ReaderState {
  return state;
}

/** `useSyncExternalStore` shape: React re-reads `getReaderState()` when this fires. */
export function subscribeReader(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(patch: Partial<ReaderState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/**
 * What we tell the user when something fails. **By error type, never by parsing strings** — and when
 * the error carries an actionable datum (how long to wait), it is used: that is why it travels as a
 * field of the class.
 */
function errorMessage(err: unknown): string {
  if (err instanceof VisionNotConfiguredError) return t.cloudNotConfigured;
  if (err instanceof VisionNetworkError) return t.cloudUnavailable;
  if (err instanceof VisionQuotaError) return `${t.quotaExhausted} ${err.retryAfterSeconds} s.`;
  return `${t.cloudFailed} (${err instanceof Error ? err.message : String(err)})`;
}

/**
 * Sends the reading to the device's speaker: synthesize to a file in the cloud, POST it over WiFi
 * (ADR 0003). Returns whether the user is actually going to hear it there.
 *
 * **It is awaited, and that is the whole point.** Until 2026-09-11 this was fire-and-forget after the
 * announcement, because the phone had already spoken and this was a spare copy for hardware that did
 * not exist. Now it can be the ONLY output, so it has to finish **inside the audio session** that
 * `requestReading` holds open: with the screen locked, iOS gives the app a few seconds bought by the
 * BLE notification, and the keep-alive tone in `services/audio/session.ts` is what stretches them.
 * Left unawaited, the reading would be POSTed by a process iOS had already suspended — and the one
 * scenario this has to survive is precisely the phone locked in a pocket.
 *
 * It never throws: the caller falls back to the phone, and silence is not an available outcome.
 */
async function sendReadingToDevice(text: string): Promise<boolean> {
  const t0 = Date.now();
  try {
    const uri = await synthesizeToFile(text);
    // The call to the cloud TTS, measured separately from the send: they are two things that fail
    // for different reasons and take time for different reasons, and together they look like a
    // single "it was slow". Same criterion as separating the photo's ms from the pipeline's.
    record('audio.synthesis', { ms: Date.now() - t0, detail: { characters: text.length } });
    const t1 = Date.now();
    const sent = await deps.sendAudio(uri);
    record('audio.send', { ms: Date.now() - t1, detail: { sent } });
    return sent;
  } catch (err) {
    record('audio.send', {
      ms: Date.now() - t0,
      detail: { sent: false, message: err instanceof Error ? err.message : String(err) },
    });
    return false;
  }
}

/**
 * Says the reading where the user chose to hear it (`features/audio/audioOutput.ts`).
 *
 * The single delivery point for a supermarket result, so the two outputs cannot drift apart. The
 * phone is the fallback for every way the device path can fail, including the send itself coming
 * back `false`: by then the sentence has been synthesized and nobody has heard it, and paying twice
 * is much better than leaving the user with nothing.
 */
async function deliverReading(text: string): Promise<void> {
  const delivery = decideDelivery({
    output: getAudioOutput(),
    deviceReady: deps.isDeviceReady(),
    synthesisEnabled: isSynthesisEnabled,
  });
  if (delivery.target === 'device') {
    if (await sendReadingToDevice(text)) {
      record('audio.spoken', { detail: { mode: 'supermarket', characters: text.length, target: 'device' } });
      return;
    }
    record('audio.fallback', { detail: { reason: 'send-failed' } });
  } else if (delivery.fallback) {
    record('audio.fallback', { detail: { reason: delivery.fallback } });
  }
  await announce(text);
  record('audio.spoken', { detail: { mode: 'supermarket', characters: text.length, target: 'phone' } });
}

/**
 * Applies a mode change to the ADR 0007 machine. Every transition is announced through audio: the
 * user has no other state indicator.
 */
function changeMode(next: Mode, source: 'app' | 'device'): void {
  if (next === state.mode) return;
  record('mode.change', { detail: { from: state.mode, to: next, source } });
  update({ mode: next, reading: null, product: null, message: '', photoUri: null });
  void announce(MODE_ANNOUNCEMENT[next]);
}

/** A gesture made in the app's own UI. */
export function applyGesture(gesture: Gesture): void {
  const next = transition(state.mode, gesture);
  if (next !== state.mode) {
    changeMode(next, 'app');
    // The device learns the mode over BLE and turns its AP on or off. If it is not there, nothing
    // happens.
    void deps.writeMode(next);
  }
  // Asked SEPARATELY from the mode change, because the two answers differ: a double click in
  // supermarket changes no mode and still has to read. Keying the capture off the transition is
  // exactly what made the second double click do nothing in front of the shelf.
  if (requestsReading(gesture)) void requestReading('app');
}

/** The mode the device reports (physical button, ADR 0007) wins: the app mirrors and announces it. */
export function setModeFromDevice(mode: Mode): void {
  if (mode !== state.mode) changeMode(mode, 'device');
}

/** Bus mode: ALWAYS local (ADR 0006) — OCR over the photo, without touching the network. */
async function readBus(uri: string): Promise<void> {
  if (!isOcrLoaded()) {
    update({ status: 'preparing', message: t.preparing, progress: 0 });
    // The first load downloads ~250 MB: if someone reports that "the first time it does not work",
    // this number says whether it was downloading or whether it hung.
    const load = await loadOcr((p) => update({ progress: p }));
    record('ocr.load', { ms: load.ms });
  }
  update({ status: 'reading', message: t.reading, progress: null });

  const r = await readImage(uri);
  const visible = r.detections.filter((d) => d.score > 0.2).slice(0, 6);
  const busReading = guessBusReading(visible);
  const raw = visible.map((d) => d.text).join(' · ') || null;

  const spoken = phraseBusReading(busReading, raw);
  // What the OCR detected and what was taken from it: without the raw text there is no way to tell
  // "the sign was not read" from "it was read and `guessBusReading` chose wrong", which get fixed in
  // different places.
  record('reading.ok', {
    ms: r.ms,
    detail: {
      mode: 'bus',
      detections: r.detections.length,
      used: visible.length,
      raw: raw?.slice(0, 300) ?? null,
      line: busReading.line,
      destination: busReading.destination,
      spoken,
    },
  });
  update({ status: 'idle', reading: busReading, message: spoken });
  await announce(spoken);
  record('audio.spoken', { detail: { mode: 'bus', characters: spoken.length, target: 'phone' } });
  // A best-effort copy to the device's speaker, and deliberately NOT governed by the output setting:
  // bus mode has to work with no internet (ADR 0001, ADR 0006) and sending it to the device needs a
  // cloud synthesis, so it can never be the only output here. The phone has already spoken; this is
  // unawaited and swallows its own errors. ADR 0003's real answer for the bus is **prerecorded clips
  // on the board's SD**, which do not exist yet.
  if (isSynthesisEnabled) void sendReadingToDevice(spoken);
}

/**
 * Supermarket mode: the cloud vision model the user picked. With no key or no network it says so (by
 * error type) and does not read; an exhausted quota says how long to wait — that field exists to be
 * read.
 */
async function readSupermarket(image: CloudImage, signal: AbortSignal): Promise<void> {
  const chosen = deps.getModel();
  if (!chosen) {
    record('reading.failed', { detail: { mode: 'supermarket', stage: 'model', reason: 'no model configured' } });
    update({ status: 'idle', progress: null, message: t.cloudNotConfigured });
    await announce(t.cloudNotConfigured);
    return;
  }
  update({ status: 'reading', message: t.reading, progress: null });

  try {
    // The device's photo already arrives at 1024 px and in base64: it is neither rescaled nor
    // re-encoded.
    const r = await recognizeProduct({
      model: chosen,
      ...image,
      signal,
      // The quota wait is announced. The limiter already handled it, but silently: for someone who
      // cannot see the screen, an app that sleeps for up to a minute is indistinguishable from a
      // frozen one.
      onWait: (waitMs) => {
        const notice = `${t.waitingSlot} ${Math.ceil(waitMs / 1000)} s.`;
        record('cloud.wait', { ms: waitMs, detail: { model: chosen.id } });
        void announce(notice);
        update({ message: notice });
      },
    });
    const spoken = phraseProduct(r.product, r.text || null);
    record('reading.ok', {
      ms: r.ms,
      detail: {
        mode: 'supermarket',
        // The model REQUESTED and the one that ANSWERED: if they differ, the selector is not in charge.
        requestedModel: chosen.id,
        model: r.model,
        kind: r.product?.kind ?? null,
        brand: r.product?.brand ?? null,
        productDetail: r.product?.detail ?? null,
        raw: r.text?.slice(0, 300) ?? null,
        spoken,
      },
    });
    update({ status: 'idle', product: r.product, message: spoken });
    // Where this is heard is the user's choice (`features/audio/audioOutput.ts`), and it is AWAITED:
    // the device path has to finish before the `finally` releases the audio session.
    await deliverReading(spoken);
  } catch (err) {
    // The deadline first: it is our own abort, and by type it arrives dressed as a network failure.
    // Saying "the cloud did not answer" when the cloud was fine sends the user to retry the wrong
    // thing — and with the screen locked the sentence is the only thing they get.
    const timedOut = signal.aborted;
    const message = timedOut ? t.readTimedOut : errorMessage(err);
    // The error's type is what separates "no key" from "no internet" from "quota exhausted", and all
    // three look the same from outside: the app says so and does not read.
    record('reading.failed', {
      detail: {
        mode: 'supermarket',
        stage: timedOut ? 'deadline' : 'cloud',
        requestedModel: chosen.id,
        type: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        ...(err instanceof VisionQuotaError ? { waitS: err.retryAfterSeconds } : null),
      },
    });
    update({ status: 'idle', progress: null, message });
    await announce(message);
  }
}

/**
 * A whole reading: the device takes the photo, it comes down over WiFi and goes into the active
 * mode's pipeline.
 *
 * `source` says which hand asked (ADR 0007, 2026-10 update): the physical button or the app's own
 * screen. Both land here, and the "already reading" guard is what keeps a second double click from
 * queueing a photo of a scene the user has already moved past.
 */
export async function requestReading(source: 'device' | 'app'): Promise<void> {
  const mode = state.mode;
  record('reading.requested', { detail: { source, mode, alreadyReading: reading } });
  if (mode === 'idle') return; // at rest nothing is captured and nothing is announced (ADR 0007)
  if (reading) {
    // Ignored rather than queued: by the time this one finished, the extra photo would be of a scene
    // the user has already moved past — and they are about to hear the result of the one that IS
    // running. Recorded because a lot of these would mean the pipeline is too slow for how people
    // actually use the button.
    record('reading.start', { detail: { mode, ignored: 'already reading' } });
    return;
  }
  reading = true;

  // Both of these happen BEFORE the first await, and that order is the point. The session has to be
  // taken while iOS is still giving us the execution slot the BLE notification bought, and the chirp
  // is the user's only sign —and ours— that the button did something at all.
  const audio = await beginReadingAudio();
  record('audio.session', { detail: { ok: audio, source } });
  playStartEarcon();

  const t0 = Date.now();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), READING_DEADLINE_MS);
  const startedInBackground = wasStartedInBackground();

  try {
    record('reading.start', { detail: { mode, model: deps.getModel()?.id ?? null, source } });
    update({ status: 'reading', message: t.readingFromDevice, progress: null });

    let photo: DevicePhoto;
    try {
      photo = await deps.downloadPhoto({ timeoutMs: PHOTO_TIMEOUT_MS });
      // The photo's size and time separately from the total: it is what separates "the network is
      // slow" from "the model is slow", and both look the same as "it was slow".
      record('photo.ok', { ms: photo.ms, detail: { bytes: photo.bytes } });
      // Shown on screen from here on: the previous reading's photo must not outlive it, or the
      // screen would pair a fresh result with a stale image.
      update({ photoUri: photo.uri });
    } catch (err) {
      const status = err instanceof HttpDownloadError ? err.status : null;
      record('photo.failed', {
        ms: Date.now() - t0,
        // The 503 is "the device has no camera" and it says so itself; the rest is the network.
        detail: { mode, status, message: err instanceof Error ? err.message : String(err) },
      });
      // The reason is spoken: someone who cannot see the screen has no other way of knowing why the
      // button did nothing.
      const message = `${t.deviceCaptureFailed} ${err instanceof Error ? err.message : String(err)}`;
      update({ status: 'idle', progress: null, message });
      await announce(message);
      return;
    }

    try {
      if (mode === 'bus') await readBus(photo.uri);
      else await readSupermarket(photo.image, controller.signal);
    } catch (err) {
      const timedOut = controller.signal.aborted;
      record('reading.failed', {
        ms: Date.now() - t0,
        detail: {
          mode,
          stage: timedOut ? 'deadline' : mode === 'bus' ? 'ocr' : 'cloud',
          type: err instanceof Error ? err.name : typeof err,
          message: err instanceof Error ? err.message : String(err),
        },
      });
      const message = timedOut ? t.readTimedOut : `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
      update({ status: 'idle', progress: null, message });
      await announce(timedOut ? t.readTimedOut : t.error);
    }
  } finally {
    clearTimeout(deadline);
    reading = false;
    // The session is released only now: doing it a line after `announce()` would have cut the
    // announcement in half, because until 2026-09-10 `announce()` did not resolve on the last word.
    await endReadingAudio();
    // A reading that happened with the screen locked has to get its rows out before iOS suspends the
    // process again. Nothing waits for this and it cannot throw (`services/telemetry`), so it costs
    // the user nothing — and without it the only evidence of a background run lives in memory until
    // the app is next opened, which is exactly when it is too late to be useful.
    if (startedInBackground) void flush();
  }
}

/** Whether this reading began with the app not in the foreground. */
function wasStartedInBackground(): boolean {
  return AppState.currentState !== 'active';
}

/** Tests only: leaves the module as freshly loaded. */
export function resetReaderForTests(): void {
  deps = noDeps;
  state = initialState;
  reading = false;
  listeners.clear();
}
