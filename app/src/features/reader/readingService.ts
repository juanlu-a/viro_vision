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
 * Each mode keeps its own pipeline (ADR 0006). **Bus recognition never touches the network**, because
 * on the street latency matters and the signal is not guaranteed (only the optional copy to the device's
 * speaker, below, goes through cloud synthesis). Since #88 (2026-09-15) its product path runs
 * entirely on the device: the board watches, crops the banner, runs the OCR and sends the reading over
 * BLE (`ReaderBridge`, `onRecognition`). What is left here is the app's own read button in bus mode,
 * a local OCR pass on the phone over the device's whole photo. **Supermarket goes to the cloud**, to
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
import { MODE_NOTICE } from '@/features/audio/notices';
import { notify } from '@/features/audio/systemNotice';
import { guessBusReading, phraseBusReading, phraseProduct } from '@/features/reader/reading';
import type { BusReading } from '@/features/reader/reading';
import { DeviceNoAddressError } from '@/features/device/types';
import { requestsReading, transition } from '@/features/reader/modes';
import type { Gesture, Mode } from '@/features/reader/modes';
import { strings } from '@/i18n';
import { beginReadingAudio, endReadingAudio } from '@/services/audio/session';
import { stopSpeaking } from '@/services/audio/tts';
import { isSynthesisEnabled, synthesizeToFile } from '@/services/audio/synthesis';
import { errorDetail, errorType, flush, record } from '@/services/telemetry';
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

/**
 * How long the reading proper (the cloud call or the OCR, after the photo) may take before it is
 * given up. The whole cycle is capped by `READING_TOTAL_CAP_MS`.
 *
 * It exists because of the locked screen. iOS hands the app a few seconds when a BLE notification
 * wakes it; the keep-alive tone buys more, but not forever, and a reading that runs past the point
 * where the process is killed is a reading the user never hears **and** never learns about. Better
 * to fail out loud. Twelve seconds is four times the measured median cycle (~3 s, ADR 0003) and
 * still short enough that the user does not stand in front of a shelf wondering.
 */
export const READING_DEADLINE_MS = 12_000;

/**
 * The hard cap on a whole cycle, from the press to the result, waits included. Since 2026-11-20 the
 * 12 s above is armed once the photo is in (the network, mode and camera waits have their own
 * bounds), so this is what still guarantees a locked phone hears an outcome before iOS gives up — in
 * supermarket mode. The app's own bus reading (local OCR on the phone, no network) is not raced
 * against it: it never waits on anyone else.
 */
export const READING_TOTAL_CAP_MS = 30_000;

/**
 * The photo cannot have the whole budget. 4 s (~80× the measured 46 ms over the device's AP) until
 * 2026-11-20; now 7 s, because right after leaving bus mode the board makes the photo wait for the
 * frame loop to let go of the camera (up to 4 s, `BUS_RELEASE_TIMEOUT_S` on the board) — the race
 * that made the first supermarket photo after bus mode hang the camera.
 */
const PHOTO_TIMEOUT_MS = 7_000;

/**
 * How long a reading waits for the phone to be on the device's network before giving up. Right
 * after connecting, the board's AP comes up seconds after BLE and iOS takes ~10 s to (re)join it
 * (`wifi.joining` → `wifi.ready` in telemetry): a reading asked for in that window used to fail at
 * once as "no pudo sacar la foto", and only a reconnection fixed it (2026-11-20).
 */
const NETWORK_WAIT_MS = 20_000;

/** While the board's camera is starting (IMX500 firmware, 4 s to ~1 min) it answers 503. */
const CAMERA_WARMUP_WAIT_MS = 8_000;

/** How long a reading waits for the mode it was asked in to reach the board. */
const MODE_WRITE_WAIT_MS = 1_500;

const POLL_MS = 250;

/** After this long waiting for the network, the user hears that the device is connecting. */
const CONNECTING_NOTICE_AFTER_MS = 3_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * What a quota wait must leave of the reading deadline for the cloud call that follows it. The
 * measured medians are 0.8-1.7 s and the worst non-Gemini call 2.5 s
 * (`docs/mediciones/2026-09-02-modelos-supermercado.md`); a wait that eats this reserve is announced
 * and then cut short by the deadline, which is the two-sentence failure the cap exists to prevent.
 */
const CLOUD_CALL_RESERVE_MS = 5_000;

/** Synthesis + POST to the device's speaker. Past it the phone says the reading instead. */
const DEVICE_DELIVERY_TIMEOUT_MS = 8_000;

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
  /**
   * Why the last reading did not happen, when it is the device's camera. Typed and not read off
   * `message`: product mode shows this one failure and nothing else (`homeView.ts`), and matching
   * the Spanish text would silently drop it the day the phrase is reworded.
   */
  failure: 'deviceCapture' | null;
  /**
   * The phrase the last successful reading said out loud, or null. Product mode shows only this line
   * of the result, so VoiceOver can go back to it; it is cleared when a new reading starts, so it is
   * never "Leyendo…" or an error dressed as a reading.
   */
  resultPhrase: string | null;
}

const initialState: ReaderState = {
  mode: 'idle',
  status: 'idle',
  message: '',
  progress: null,
  reading: null,
  product: null,
  photoUri: null,
  failure: null,
  resultPhrase: null,
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
  downloadPhoto(options?: { timeoutMs?: number; mode?: Mode }): Promise<DevicePhoto>;
  sendAudio(uri: string, signal?: AbortSignal, mode?: Mode): Promise<boolean>;
  writeMode(mode: Mode): Promise<void>;
  /**
   * Whether the device can receive audio right now (connected, on its network, answering). Asked
   * BEFORE synthesizing: the synthesis is a paid cloud call, and spending it on audio that has
   * nowhere to go is worse than checking first.
   */
  isDeviceReady(): boolean;
  /**
   * Whether the phone is on the device's network, so the photo can come down. Today the same
   * condition as `isDeviceReady`, asked under its own name because the reading WAITS on this one
   * (`waitForDeviceNetwork`) and only consults the other. Absent means "assume it is".
   */
  isNetworkReady?(): boolean;
  /**
   * Asks the system to put the phone on the device's network (the iOS prompt). Called by a reading
   * that needs the photo and found the phone elsewhere: on connection, a network already joined is
   * only waited for, never asked for (2026-11-20).
   */
  joinDeviceNetwork?(): Promise<boolean>;
  /**
   * Cuts whatever the device's speaker is playing. Used before the phone speaks, so the two outputs
   * cannot end up talking over each other (ADR 0003, act. 2026-09-18).
   */
  hushDevice(): Promise<void>;
}

const noDeps: ReaderDeps = {
  getModel: () => null,
  downloadPhoto: () => Promise.reject(new DeviceNoAddressError()),
  sendAudio: () => Promise.resolve(false),
  writeMode: () => Promise.resolve(),
  isDeviceReady: () => false,
  hushDevice: () => Promise.resolve(),
};

let deps: ReaderDeps = noDeps;
let state: ReaderState = initialState;
let reading = false;
/**
 * Bumped on every mode change. A reading remembers the epoch it started in and, after each await,
 * gives up in silence if the epoch moved: once the user has switched mode, whatever the previous
 * mode was about to say (a product, "elemento no reconocible", an error) is no longer theirs to hear,
 * and saying it on top of "modo ómnibus activado" is the overlap reported on 2026-11-20.
 */
let modeEpoch = 0;
/** The running reading's abort, so a mode change can stop its cloud call, synthesis and POST. */
let readingAbort: AbortController | null = null;
/**
 * The last mode write to the board, still in flight. A double click from bus asks for the photo in
 * the same instant it writes the mode: the photo has to reach a board that already knows it left
 * bus mode, so it can wait for the frame loop to release the camera.
 */
let pendingModeWrite: Promise<void> | null = null;
/**
 * The modes the app left through writes still in flight: the only board reports the echo filter may
 * drop. Every in-flight write counts, not only the last one: after a fast A → B → C the board can
 * still report A (B's write not applied yet) and, remembering only "B before C", that stale A used
 * to flip the app back and cancel the reading just started.
 */
const modesLeftInFlight: { write: Promise<void>; from: Mode }[] = [];
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
 *
 * **Never the error's own text** (2026-10-06): the user hears what to do, in plain language, and the
 * technical detail goes only to the telemetry row recorded next to every call of this.
 */
function errorMessage(err: unknown): string {
  if (err instanceof VisionNotConfiguredError) return t.cloudNotConfigured;
  if (err instanceof VisionNetworkError) return t.cloudUnavailable;
  if (err instanceof VisionQuotaError) {
    const s = Math.max(1, Math.ceil(err.retryAfterSeconds));
    return `${t.quotaExhausted} ${s} ${s === 1 ? t.second : t.seconds}`;
  }
  return t.cloudFailed;
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
async function sendReadingToDevice(text: string, mode: Mode, cancel?: AbortSignal): Promise<boolean> {
  const t0 = Date.now();
  // Bounded, because nothing else bounds it: this leg runs after the reading deadline was already
  // cleared, and a POST to a phone that just left the device's AP hangs until the OS gives up. Until
  // 2026-10-06 that kept `reading` true and the session open, and every press meanwhile was dropped
  // as "already reading". On abort the phone speaks instead.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEVICE_DELIVERY_TIMEOUT_MS);
  // A mode change cancels the delivery too: a supermarket MP3 that lands on the board after the user
  // switched to bus is exactly the voice that talked over the bus announcements.
  const onCancel = (): void => controller.abort();
  if (cancel?.aborted) controller.abort();
  cancel?.addEventListener('abort', onCancel);
  try {
    const uri = await synthesizeToFile(text, new Date(), controller.signal);
    // The call to the cloud TTS, measured separately from the send: they are two things that fail
    // for different reasons and take time for different reasons, and together they look like a
    // single "it was slow". Same criterion as separating the photo's ms from the pipeline's.
    record('audio.synthesis', { ms: Date.now() - t0, detail: { characters: text.length } });
    // Cancelled while synthesizing (a mode change, or the delivery timeout): the POST would only
    // carry audio nobody should hear now.
    if (controller.signal.aborted) throw new Error('device delivery cancelled');
    const t1 = Date.now();
    const sent = await deps.sendAudio(uri, controller.signal, mode);
    record('audio.send', { ms: Date.now() - t1, detail: { sent } });
    return sent;
  } catch (err) {
    record('audio.send', {
      ms: Date.now() - t0,
      detail: { sent: false, timedOut: controller.signal.aborted, message: errorDetail(err) },
    });
    return false;
  } finally {
    clearTimeout(timer);
    cancel?.removeEventListener('abort', onCancel);
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
async function deliverReading(text: string, isStale: () => boolean, cancel: AbortSignal): Promise<void> {
  if (isStale()) return;
  const delivery = decideDelivery({
    output: getAudioOutput(),
    deviceReady: deps.isDeviceReady(),
    synthesisEnabled: isSynthesisEnabled,
  });
  if (delivery.target === 'device') {
    // One voice at a time: the phone goes quiet before the board speaks. Each output already
    // interrupted itself and neither the other, and overlapping voices are not information for
    // someone who cannot see the screen.
    stopSpeaking();
    const sent = await sendReadingToDevice(text, 'supermarket', cancel);
    // The mode changed while it was being sent: the phone must not pick it up as a fallback either.
    if (isStale()) return;
    if (sent) {
      record('audio.spoken', { detail: { mode: 'supermarket', characters: text.length, target: 'device' } });
      return;
    }
    record('audio.fallback', { detail: { reason: 'send-failed' } });
  } else if (delivery.fallback) {
    record('audio.fallback', { detail: { reason: delivery.fallback } });
  }
  // And the other way round: if the phone speaks, the board goes quiet. No `await`, so the reading
  // is not delayed behind a BLE write.
  hushDeviceQuietly();
  await announce(text);
  record('audio.spoken', { detail: { mode: 'supermarket', characters: text.length, target: 'phone' } });
}

/** Cuts the board's speaker without waiting and without ever throwing (not even synchronously). */
function hushDeviceQuietly(): void {
  try {
    void deps.hushDevice().catch(() => {});
  } catch {
    // the announcement path never throws
  }
}

/** Waits for `promise` or `ms`, whichever comes first, and leaves no timer behind. */
async function waitAtMost(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise, new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)))]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Applies a mode change to the ADR 0007 machine. Every transition is announced through audio: the
 * user has no other state indicator.
 */
function changeMode(next: Mode, source: 'app' | 'device'): void {
  if (next === state.mode) return;
  record('mode.change', { detail: { from: state.mode, to: next, source, cancelledReading: reading } });
  // The previous mode goes quiet before the new one is announced (2026-11-20): its reading in flight
  // is cancelled and marked stale, and both outputs are cut. Each output only ever interrupted
  // itself, so a supermarket result on the board and "modo ómnibus activado" on the phone (or the
  // other way round) used to play at the same time.
  modeEpoch += 1;
  readingAbort?.abort();
  readingAbort = null;
  // The cancelled reading no longer blocks: it ends on its own, silently, and the new mode can read
  // right away (a double click from bus to supermarket must take its photo).
  reading = false;
  stopSpeaking();
  hushDeviceQuietly();
  update({ mode: next, status: 'idle', progress: null, reading: null, product: null, message: '', photoUri: null, failure: null, resultPhrase: null });
  // A system notice and no longer a bare `announce()`: since 2026-09-16 it comes out of the output
  // the user chose, like everything else. `void` because the transition is already applied — the
  // mode must not wait on a speaker.
  void notify(MODE_NOTICE[next]).then((target) => record('audio.spoken', { detail: { notice: MODE_NOTICE[next], target } }));
}

/** A gesture made in the app's own UI. */
export function applyGesture(gesture: Gesture): void {
  const transitionFrom = state.mode;
  const next = transition(transitionFrom, gesture);
  if (next !== state.mode) {
    changeMode(next, 'app');
    // The device learns the mode over BLE and turns its AP on or off. If it is not there, nothing
    // happens.
    const previous = transitionFrom;
    // Bounded: a GATT write that never answers must not keep the echo filter on for good.
    const write = waitAtMost(
      Promise.resolve()
        .then(() => deps.writeMode(next))
        .catch(() => {}),
      MODE_WRITE_WAIT_MS,
    );
    pendingModeWrite = write;
    const entry = { write, from: previous };
    modesLeftInFlight.push(entry);
    void write.then(() => {
      const index = modesLeftInFlight.indexOf(entry);
      if (index !== -1) modesLeftInFlight.splice(index, 1);
      if (pendingModeWrite === write) pendingModeWrite = null;
    });
  }
  // Asked SEPARATELY from the mode change, because the two answers differ: a double click in
  // supermarket changes no mode and still has to read. Keying the capture off the transition is
  // exactly what made the second double click do nothing in front of the shelf.
  if (requestsReading(gesture)) void requestReading('app');
}

/** The mode the device reports (physical button, ADR 0007) wins: the app mirrors and announces it. */
export function setModeFromDevice(mode: Mode): void {
  // While the app's own mode write is in flight, the board may still report the mode BEFORE it (a
  // fast bus → supermarket): applying that echo would flip the app back, cancel the reading just
  // started and announce a mode the user already left. The write's own echo arrives after it.
  // Only that echo: any other mode is a real press on the board and wins as always.
  if (mode !== state.mode && modesLeftInFlight.some((entry) => entry.from === mode)) {
    record('mode.echoIgnored', { detail: { reported: mode, current: state.mode } });
    return;
  }
  if (mode !== state.mode) changeMode(mode, 'device');
}

/**
 * The board's button asked for a reading, in the mode the board says it is in.
 *
 * **The mode is applied first, and that ordering is the whole function.** One double click makes the
 * board send two things: the new mode on the `mode` characteristic, and a `read` event. They reach
 * this module at very different speeds — `read` is served straight from the BLE callback, while the
 * mode travels `onMode` → provider state → render → effect, and React does not commit inside a
 * native callback. So the reading always arrived first and was judged against the mode from BEFORE
 * the click: from idle it hit `requestReading`'s `mode === 'idle'` guard and was dropped in silence.
 * That is the bug reported on 2026-09-13 — the double click switched to supermarket, took no photo,
 * and only the NEXT double click read anything.
 *
 * `mode` is null only for a board from before the event carried it; then the app's own mode is all
 * there is, which is the old behaviour and no worse than it was.
 */
export function readFromDevice(mode: Mode | null): Promise<void> {
  if (mode) setModeFromDevice(mode);
  return requestReading('device');
}

/** Bus mode: ALWAYS local (ADR 0006): OCR over the photo, no network to read it. */
async function readBus(uri: string, isStale: () => boolean, cancel: AbortSignal): Promise<void> {
  if (!isOcrLoaded()) {
    update({ status: 'preparing', message: t.preparing, progress: 0 });
    // The first load downloads ~250 MB: if someone reports that "the first time it does not work",
    // this number says whether it was downloading or whether it hung.
    // A mode change while the model downloads resets the status to idle; a stale reading must not
    // write over it, or Home's read button stays disabled until the next mode change.
    const load = await loadOcr((p) => {
      if (!isStale()) update({ progress: p });
    });
    record('ocr.load', { ms: load.ms });
    if (isStale()) return;
  }
  update({ status: 'reading', message: t.reading, progress: null });

  const r = await readImage(uri);
  if (isStale()) return;
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
  update({ status: 'idle', reading: busReading, message: spoken, resultPhrase: spoken });
  await announce(spoken);
  record('audio.spoken', { detail: { mode: 'bus', characters: spoken.length, target: 'phone' } });
  // A best-effort copy to the device's speaker, and deliberately NOT governed by the output setting:
  // bus mode has to work with no internet (ADR 0001, ADR 0006) and sending it to the device needs a
  // cloud synthesis, so it can never be the only output here. The phone has already spoken; this is
  // unawaited and swallows its own errors. ADR 0003's real answer for the bus is **prerecorded clips
  // on the board's SD**: the board has them now (`bus_banner.announcements`, a `.wav` per line and
  // destination, plus the notices in `hardware/raspi/virovision/notices.py`), but this reading is
  // OCR'd on the phone and nothing here asks the board to play a clip for it, so this copy still
  // goes through synthesis.
  //
  // Only when the user chose the device AND it can receive it: with the output on the phone this
  // copy was a second voice saying the same line (`audioOutput.ts`), and with no device network it
  // paid for a cloud synthesis that had nowhere to go.
  if (!isStale() && isSynthesisEnabled && getAudioOutput() === 'device' && deps.isDeviceReady()) {
    void sendReadingToDevice(spoken, 'bus', cancel);
  }
}

/**
 * Supermarket mode: the cloud vision model the user picked. With no key or no network it says so (by
 * error type) and does not read; an exhausted quota says how long to wait — that field exists to be
 * read.
 */
async function readSupermarket(
  image: CloudImage,
  signal: AbortSignal,
  deadlineAt: number,
  isStale: () => boolean,
  cancel: AbortSignal,
): Promise<void> {
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
      // A quota wait longer than what is left of the deadline is not announced: it could never
      // finish. It fails at once as an exhausted quota, which says how long to wait instead.
      // The cloud call itself needs time after the wait, so that time is kept back too.
      maxWaitMs: Math.max(0, deadlineAt - Date.now() - CLOUD_CALL_RESERVE_MS),
      // The quota wait is announced. The limiter already handled it, but silently: for someone who
      // cannot see the screen, an app that sleeps for up to a minute is indistinguishable from a
      // frozen one.
      onWait: (waitMs) => {
        if (isStale()) return;
        const notice = `${t.waitingSlot} ${Math.ceil(waitMs / 1000)} s.`;
        record('cloud.wait', { ms: waitMs, detail: { model: chosen.id } });
        void announce(notice);
        update({ message: notice });
      },
    });
    if (isStale()) return;
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
    update({ status: 'idle', product: r.product, message: spoken, resultPhrase: spoken });
    // Where this is heard is the user's choice (`features/audio/audioOutput.ts`), and it is AWAITED:
    // the device path has to finish before the `finally` releases the audio session.
    // The mode change's signal and not the deadline's: a synthesis that runs past the deadline still
    // reaches the device (its own 8 s cap bounds it); only leaving the mode cancels it.
    await deliverReading(spoken, isStale, cancel);
  } catch (err) {
    // Cancelled by a mode change: nothing to say, the new mode has already been announced.
    if (isStale()) {
      record('reading.cancelled', { detail: { mode: 'supermarket', stage: 'cloud' } });
      return;
    }
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
        type: errorType(err),
        message: errorDetail(err),
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
  const epoch = modeEpoch;
  const isStale = (): boolean => epoch !== modeEpoch;

  // Both of these happen right at the start, before any of the slow work (photo, OCR, cloud), and
  // that order is the point. The session is the first thing awaited, while iOS is still giving us
  // the execution slot the BLE notification bought, and the chirp follows immediately: it is the
  // user's only sign —and ours— that the button did something at all.
  const audio = await beginReadingAudio();
  record('audio.session', { detail: { ok: audio, source } });
  // Through the notice router since 2026-09-16, so the chirp comes out of the same place as the
  // reading it announces. Still unawaited, and still the first sound of the cycle: `notify` runs
  // synchronously as far as the earcon on the phone path, and the device path is one BLE write
  // without response.
  void notify('readingStarted');

  // Two aborts. `cancel` is the mode change's (`changeMode`): it stops everything, delivery included.
  // `controller` is the deadline's, and also follows `cancel`; it covers the cloud call and is armed
  // only once the photo is in, because the photo has its own bounds (timeout, warm-up retries) and a
  // deadline that started before them used to expire on a cloud that had not been asked yet.
  const pressedAt = Date.now();
  const cancel = new AbortController();
  const controller = new AbortController();
  cancel.signal.addEventListener('abort', () => controller.abort(), { once: true });
  // The photo comes over the device's WiFi: wait for the phone to be on it, and for the mode just
  // written to reach the board. Both happen in the first seconds after connecting or switching.
  // Synchronous in the usual case: every extra await here is time iOS may not give a locked phone.
  // Every wait below takes from the same total budget, so the cap holds for the whole cycle.
  const left = (): number => pressedAt + READING_TOTAL_CAP_MS - Date.now();
  const networkWaitStart = Date.now();
  const networkReady = isNetworkReady() || (await waitForDeviceNetwork(isStale, Math.min(NETWORK_WAIT_MS, left())));
  const networkWaitedMs = Date.now() - networkWaitStart;
  if (pendingModeWrite) await waitAtMost(pendingModeWrite, MODE_WRITE_WAIT_MS);
  // A mode change during the awaits above already moved on: do not start a reading for the old mode.
  if (isStale()) {
    record('reading.cancelled', { detail: { mode, stage: 'start' } });
    await endReadingAudio();
    return;
  }
  readingAbort = cancel;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const t0 = Date.now();
  const startedInBackground = wasStartedInBackground();

  try {
    record('reading.start', { detail: { mode, model: deps.getModel()?.id ?? null, source } });
    update({ status: 'reading', message: t.readingFromDevice, progress: null, failure: null, resultPhrase: null });

    if (!networkReady) {
      record('photo.failed', { ms: 0, detail: { mode, status: null, message: 'the phone is not on the device network', waitedMs: networkWaitedMs } });
      update({ status: 'idle', progress: null, message: t.deviceNetworkNotReady, failure: 'deviceCapture' });
      await announce(t.deviceNetworkNotReady);
      return;
    }

    let photo: DevicePhoto;
    try {
      photo = await downloadPhotoWhenCameraReady(isStale, mode, left);
      // The photo's size and time separately from the total: it is what separates "the network is
      // slow" from "the model is slow", and both look the same as "it was slow".
      record('photo.ok', { ms: photo.ms, detail: { bytes: photo.bytes } });
      // Shown on screen from here on: the previous reading's photo must not outlive it, or the
      // screen would pair a fresh result with a stale image.
      if (isStale()) {
        record('reading.cancelled', { detail: { mode, stage: 'photo' } });
        return;
      }
      update({ photoUri: photo.uri });
    } catch (err) {
      if (isStale()) {
        record('reading.cancelled', { detail: { mode, stage: 'photo' } });
        return;
      }
      const status = err instanceof HttpDownloadError ? err.status : null;
      record('photo.failed', {
        ms: Date.now() - t0,
        // The 503 is "the device has no camera" and it says so itself; the rest is the network.
        detail: { mode, status, message: errorDetail(err) },
      });
      // Something is spoken: someone who cannot see the screen has no other way of knowing why the
      // button did nothing. The reason itself is not — it is in the row above. A camera still
      // starting says so: "probá de nuevo" right away would fail the same way.
      const phrase = status === 503 ? t.deviceCameraWarmingUp : t.deviceCaptureFailed;
      update({ status: 'idle', progress: null, message: phrase, failure: 'deviceCapture' });
      await announce(phrase);
      return;
    }

    try {
      const deadlineAt = Math.min(Date.now() + READING_DEADLINE_MS, pressedAt + READING_TOTAL_CAP_MS);
      deadline = setTimeout(() => controller.abort(), Math.max(0, deadlineAt - Date.now()));
      if (mode === 'bus') await readBus(photo.uri, isStale, cancel.signal);
      else await readSupermarket(photo.image, controller.signal, deadlineAt, isStale, cancel.signal);
    } catch (err) {
      if (isStale()) {
        record('reading.cancelled', { detail: { mode, stage: mode === 'bus' ? 'ocr' : 'cloud' } });
        return;
      }
      const timedOut = controller.signal.aborted;
      record('reading.failed', {
        ms: Date.now() - t0,
        detail: {
          mode,
          stage: timedOut ? 'deadline' : mode === 'bus' ? 'ocr' : 'cloud',
          type: errorType(err),
          message: errorDetail(err),
        },
      });
      const message = timedOut ? t.readTimedOut : t.error;
      update({ status: 'idle', progress: null, message });
      await announce(message);
    }
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
    // Only if this reading still owns the flag: after a mode change a newer one may be running.
    if (!isStale()) {
      reading = false;
      readingAbort = null;
    }
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

/** Whether the phone is on the device's network right now (true when the deps cannot tell). */
function isNetworkReady(): boolean {
  return deps.isNetworkReady ? deps.isNetworkReady() : true;
}

/**
 * Waits, bounded, for the phone to be on the device's network (`isDeviceReady`: connected, joined,
 * answering). True at once in the usual case. False when it never came or the mode changed meanwhile.
 */
async function waitForDeviceNetwork(isStale: () => boolean, limitMs: number): Promise<boolean> {
  const t0 = Date.now();
  let told = false;
  // The user asked for a reading that needs the photo: now the prompt is worth it. Not with the app
  // in the background, where iOS cannot show it.
  if (deps.joinDeviceNetwork && AppState.currentState === 'active') {
    record('photo.joiningNetwork');
    void deps.joinDeviceNetwork().catch(() => false);
  }
  while (Date.now() - t0 < limitMs) {
    await sleep(POLL_MS);
    if (isStale()) return false;
    // A wait this long after the chirp, in silence, sounds like a hang to someone who cannot see the
    // screen. Said once.
    if (!told && Date.now() - t0 >= CONNECTING_NOTICE_AFTER_MS) {
      told = true;
      // On the phone on purpose: the device's audio path needs the very network being waited for.
      void announce(t.deviceConnecting);
    }
    if (isNetworkReady()) {
      // The "conectando" may still be talking: the reading's own sounds come next.
      if (told) stopSpeaking();
      record('photo.waitedNetwork', { ms: Date.now() - t0 });
      return true;
    }
  }
  return false;
}

/**
 * The device's photo, retried while its camera answers 503 (still starting after a power-on or a
 * restart). Any other failure, or a 503 that outlasts the wait, is thrown as it came.
 */
async function downloadPhotoWhenCameraReady(
  isStale: () => boolean,
  mode: Mode,
  left: () => number,
): Promise<DevicePhoto> {
  const t0 = Date.now();
  for (;;) {
    try {
      // Never past the cycle's total budget, and never below a second, which no photo fits in.
      return await deps.downloadPhoto({ timeoutMs: Math.max(1_000, Math.min(PHOTO_TIMEOUT_MS, left())), mode });
    } catch (err) {
      const warming = err instanceof HttpDownloadError && err.status === 503;
      if (!warming || isStale() || Date.now() - t0 >= CAMERA_WARMUP_WAIT_MS || left() <= 2_000) throw err;
      await sleep(1_000);
      // The mode may have changed during the wait: one more photo would go to a board that has moved on.
      if (isStale()) throw err;
    }
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
  modeEpoch = 0;
  readingAbort = null;
  pendingModeWrite = null;
  modesLeftInFlight.length = 0;
  listeners.clear();
}
