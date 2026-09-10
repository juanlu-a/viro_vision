/**
 * Home's reader, by operating mode (ADR 0007): idle, bus, supermarket.
 *
 * Each mode has its own pipeline (ADR 0006). **Bus always runs locally**: OCR over the banner — in
 * the product the device's TPU crops it; today, with no hardware, over the whole photo — because out
 * on the street latency rules and signal is not guaranteed. **Supermarket goes to the cloud**, to
 * the vision model the user picked in Settings: they are standing still and trade latency for
 * accuracy. With no internet or no key, supermarket **says so** and does not read: the local
 * fallback for that mode is still pending (ADR 0006, 2026-08-30 update).
 *
 * The image ALWAYS comes from the **device's camera** (ADR 0003: the photo comes down over WiFi, BLE
 * is the control plane). Until 2026-09-08 there were also the phone's camera and the photo library,
 * holding that place while there was no hardware; with the device working they left, because a
 * second image source is a second path to test and maintain for a product that does not have one.
 *
 * The mode is kept in sync with the device: the app's gestures are written to it over BLE (it turns
 * its AP on with a mode active) and whatever mode the device reports (physical button, ADR 0007) is
 * mirrored here.
 *
 * Every mode transition and every result is **announced by voice**: this is an app for people who do
 * not see the screen. What stays on screen is the result, nothing else: the timings, which model
 * answered and the raw text go to telemetry (`services/telemetry`), not to the interface.
 *
 * Events are recorded **here and not inside `announce()`**: telemetry is network and ADR 0001 forbids
 * it on the announcement path (the linter enforces it). `record()` is synchronous and waits for
 * nothing, so no reading is delayed by it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
import { useDevice } from '@/features/device/DeviceProvider';
import { guessBusReading, phraseBusReading, phraseProduct } from '@/features/reader/reading';
import type { BusReading } from '@/features/reader/reading';
import { transition } from '@/features/reader/modes';
import type { Gesture, Mode } from '@/features/reader/modes';
import { useProductModel } from '@/features/reader/ProductModelProvider';
import { strings } from '@/i18n';
import { isSynthesisEnabled, synthesizeToFile } from '@/services/audio/synthesis';
import { record } from '@/services/telemetry';
import { HttpDownloadError } from '@/services/wifi/deviceHttp';
import type { CloudImage } from '@/services/camera';
import { loadOcr, readImage, releaseOcr, isOcrLoaded } from '@/services/ondevice';
import {
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  recognizeProduct,
} from '@/services/vision';
import type { ProductReading } from '@/services/vision';

const t = strings.reader;

const MODE_ANNOUNCEMENT: Record<Mode, string> = {
  idle: t.announceIdle,
  bus: t.announceBus,
  supermarket: t.announceSupermarket,
};

export interface ReaderState {
  mode: Mode;
  status: 'idle' | 'preparing' | 'reading';
  message: string;
  /** Fraction 0-1 while the OCR downloads its model for the first time. */
  progress: number | null;
  reading: BusReading | null;
  product: ProductReading | null;
}

const initialState: ReaderState = {
  mode: 'idle',
  status: 'idle',
  message: '',
  progress: null,
  reading: null,
  product: null,
};

/**
 * What we tell the user when something fails. **By error type, never by parsing strings** — and when
 * the error carries an actionable datum (how long to wait, whether a permission can be asked for
 * again), it is used: that is why it travels as a field of the class.
 */
function errorMessage(err: unknown): string {
  if (err instanceof VisionNotConfiguredError) return t.cloudNotConfigured;
  if (err instanceof VisionNetworkError) return t.cloudUnavailable;
  if (err instanceof VisionQuotaError) return `${t.quotaExhausted} ${err.retryAfterSeconds} s.`;
  return `${t.cloudFailed} (${err instanceof Error ? err.message : String(err)})`;
}

/**
 * Leaves the reading in an `.mp3`, for the device's speaker. **Best-effort on purpose**: it is
 * called AFTER `announce()` and without `await` on the critical path, and it swallows any error.
 *
 * If it fails, the user has already heard the product through the phone's speaker. The file exists
 * for hardware that does not exist yet (see `services/audio/synthesis.ts`) and it cannot degrade what
 * works today — accessibility is the design criterion, not a layer.
 *
 * It lives here and not inside `announce()` on purpose: `features/audio/` is forbidden from
 * depending on the network (ADR 0001, enforced by the linter). The announcement has to play without
 * internet; the file does not. Putting it behind the announcement would place a network call on the
 * path ADR 0001 protects.
 */
async function saveReadingAudio(
  text: string,
  sendToDevice?: (uri: string) => Promise<boolean>,
): Promise<void> {
  if (!isSynthesisEnabled) return;
  const t0 = Date.now();
  try {
    const uri = await synthesizeToFile(text);
    // The call to the cloud TTS, measured separately from the send: they are two things that fail
    // for different reasons and take time for different reasons, and together they look like a
    // single "it was slow". Same criterion as separating the photo's ms from the pipeline's.
    const synthesisMs = Date.now() - t0;
    record('audio.synthesis', { ms: synthesisMs, detail: { characters: text.length } });
    // And on to the device's speaker, over WiFi (ADR 0003). The user has already heard the reading
    // through the phone: this is the final device's path, not what guarantees the announcement today.
    const t1 = Date.now();
    const sent = sendToDevice ? await sendToDevice(uri) : false;
    record('audio.send', { ms: Date.now() - t1, detail: { sent } });
  } catch (err) {
    // Deliberate silence for the user: nothing they do depends on this. But it is recorded, because
    // it is the device speaker's path and it fails without anyone noticing.
    record('audio.send', {
      ms: Date.now() - t0,
      detail: { sent: false, message: err instanceof Error ? err.message : String(err) },
    });
  }
}

export function useReader() {
  const [state, setState] = useState<ReaderState>(initialState);
  const ref = useRef(initialState);
  const alive = useRef(true);
  const { model } = useProductModel();
  const device = useDevice();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Home is the screen that is always mounted, but for hygiene: if the tree goes away, we do not
      // leave the OCR model mapped.
      releaseOcr();
    };
  }, []);

  const update = useCallback((patch: Partial<ReaderState>) => {
    ref.current = { ...ref.current, ...patch };
    if (alive.current) setState(ref.current);
  }, []);

  /**
   * Applies a button gesture (the app's today; the device's when it exists) to the ADR 0007 machine.
   * Every transition is announced through audio: the user has no other state indicator.
   */
  const changeMode = useCallback(
    (next: Mode, source: 'app' | 'device') => {
      if (next === ref.current.mode) return;
      record('mode.change', { detail: { from: ref.current.mode, to: next, source } });
      update({ mode: next, reading: null, product: null, message: '' });
      announce(MODE_ANNOUNCEMENT[next]);
    },
    [update],
  );

  const applyGesture = useCallback(
    (gesture: Gesture) => {
      const next = transition(ref.current.mode, gesture);
      if (next === ref.current.mode) return;
      changeMode(next, 'app');
      // The device learns the mode over BLE and turns its AP on or off. If it is not there, nothing
      // happens.
      void device.writeMode(next);
    },
    [changeMode, device],
  );

  // The mode reported by the device (physical button) wins: the app mirrors and announces it.
  const modeFromDevice = device.deviceMode;
  useEffect(() => {
    if (modeFromDevice && modeFromDevice !== ref.current.mode) changeMode(modeFromDevice, 'device');
  }, [modeFromDevice, changeMode]);

  /** Bus mode: ALWAYS local (ADR 0006) — OCR over the photo, without touching the network. */
  const readBus = useCallback(
    async (uri: string) => {
      if (!isOcrLoaded()) {
        update({ status: 'preparing', message: t.preparing, progress: 0 });
        // The first load downloads ~250 MB: if someone reports that "the first time it does not
        // work", this number says whether it was downloading or whether it hung.
        const load = await loadOcr((p) => update({ progress: p }));
        record('ocr.load', { ms: load.ms });
      }
      update({ status: 'reading', message: t.reading, progress: null });

      const r = await readImage(uri);
      const visible = r.detections.filter((d) => d.score > 0.2).slice(0, 6);
      const reading = guessBusReading(visible);
      const raw = visible.map((d) => d.text).join(' · ') || null;

      const spoken = phraseBusReading(reading, raw);
      announce(spoken);
      // What the OCR detected and what was taken from it: without the raw text there is no way to
      // tell "the sign was not read" from "it was read and `guessBusReading` chose wrong", which get
      // fixed in different places.
      record('reading.ok', {
        ms: r.ms,
        detail: {
          mode: 'bus',
          detections: r.detections.length,
          used: visible.length,
          raw: raw?.slice(0, 300) ?? null,
          line: reading.line,
          destination: reading.destination,
          spoken,
        },
      });
      update({ status: 'idle', reading, message: spoken });
      void saveReadingAudio(spoken, device.sendAudio);
    },
    [update, device.sendAudio],
  );

  /**
   * Supermarket mode: the cloud vision model the user picked. With no key or no network it says so
   * (by error type) and does not read; an exhausted quota says how long to wait — that field exists
   * to be read.
   */
  const readSupermarket = useCallback(
    async (image: CloudImage) => {
      const chosen = model;
      if (!chosen) {
        record('reading.failed', { detail: { mode: 'supermarket', stage: 'model', reason: 'no model configured' } });
        announce(t.cloudNotConfigured);
        update({ status: 'idle', progress: null, message: t.cloudNotConfigured });
        return;
      }
      update({ status: 'reading', message: t.reading, progress: null });

      try {
        // The device's photo already arrives at 1024 px and in base64: it is neither rescaled nor
        // re-encoded.
        const r = await recognizeProduct({
          model: chosen,
          ...image,
          // The quota wait is announced. The limiter already handled it, but silently: for someone
          // who cannot see the screen, an app that sleeps for up to a minute is indistinguishable
          // from a frozen one. The callback had been there from the start and nobody called it.
          onWait: (waitMs) => {
            const notice = `${t.waitingSlot} ${Math.ceil(waitMs / 1000)} s.`;
            record('cloud.wait', { ms: waitMs, detail: { model: chosen } });
            announce(notice);
            update({ message: notice });
          },
        });
        const spoken = phraseProduct(r.product, r.text || null);
        announce(spoken);
        record('reading.ok', {
          ms: r.ms,
          detail: {
            mode: 'supermarket',
            // The model REQUESTED and the one that ANSWERED: if they differ, the selector is not in
            // charge.
            requestedModel: chosen,
            model: r.model,
            kind: r.product?.kind ?? null,
            brand: r.product?.brand ?? null,
            productDetail: r.product?.detail ?? null,
            raw: r.text?.slice(0, 300) ?? null,
            spoken,
          },
        });
        update({ status: 'idle', product: r.product, message: spoken });
        void saveReadingAudio(spoken, device.sendAudio);
      } catch (err) {
        const message = errorMessage(err);
        // The error's type is what separates "no key" from "no internet" from "quota exhausted", and
        // all three look the same from outside: the app says so and does not read.
        record('reading.failed', {
          detail: {
            mode: 'supermarket',
            stage: 'cloud',
            requestedModel: chosen,
            type: err instanceof Error ? err.name : typeof err,
            message: err instanceof Error ? err.message : String(err),
            ...(err instanceof VisionQuotaError ? { waitS: err.retryAfterSeconds } : null),
          },
        });
        announce(message);
        update({ status: 'idle', progress: null, message });
      }
    },
    // The model comes in as a dependency: switching models recreates the callback, which is exactly
    // what we want — the next reading uses the chosen one.
    [model, update, device.sendAudio],
  );

  /**
   * A whole reading: the device takes the photo, it comes down over WiFi and goes into the active
   * mode's pipeline.
   *
   * It is the only path since the phone's camera and the photo library left (2026-09-08). Without a
   * device with a network the button is disabled and the screen says so, so there is no fallback
   * here: inventing one would put two paths back where the product has one.
   */
  const read = useCallback(async () => {
    const { mode } = ref.current;
    if (mode === 'idle') return; // at rest nothing is captured and nothing is announced (ADR 0007)
    const t0 = Date.now();
    record('reading.start', { detail: { mode, model: model ?? null } });
    update({ status: 'reading', message: t.readingFromDevice, progress: null });

    let photo;
    try {
      photo = await device.downloadPhoto();
      // The photo's size and time separately from the total: it is what separates "the network is
      // slow" from "the model is slow", and both look the same as "it was slow".
      record('photo.ok', { ms: photo.ms, detail: { bytes: photo.bytes } });
    } catch (err) {
      const status = err instanceof HttpDownloadError ? err.status : null;
      record('photo.failed', {
        ms: Date.now() - t0,
        // The 503 is "the device has no camera" and it says so itself; the rest is the network.
        detail: { mode, status, message: err instanceof Error ? err.message : String(err) },
      });
      // The reason is spoken: someone who cannot see the screen has no other way of knowing why the
      // button did nothing. The device tells "no camera" (503) apart from a network that does not
      // answer.
      const message = `${t.deviceCaptureFailed} ${err instanceof Error ? err.message : String(err)}`;
      announce(message);
      update({ status: 'idle', progress: null, message });
      return;
    }

    try {
      if (mode === 'bus') await readBus(photo.uri);
      else await readSupermarket(photo.image);
    } catch (err) {
      record('reading.failed', {
        ms: Date.now() - t0,
        detail: {
          mode,
          stage: mode === 'bus' ? 'ocr' : 'cloud',
          type: err instanceof Error ? err.name : typeof err,
          message: err instanceof Error ? err.message : String(err),
        },
      });
      const message = `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
      announce(t.error);
      update({ status: 'idle', progress: null, message });
    }
  }, [device, readBus, readSupermarket, model, update]);

  return {
    state,
    applyGesture,
    read,
    model,
    /** The device can take the photo now: connected, with a network and answering. Without this there is no reading. */
    deviceReady: device.photoAvailable,
    // The device is connected and its network is coming up: reading is about to be enabled.
    deviceConnecting: device.connection.status === 'connected' && device.wifi === 'joining',
    /** For Home's status line: what is going on on the device side, in one word. */
    deviceState:
      device.connection.status === 'connected'
        ? device.wifi === 'ready'
          ? ('ready' as const)
          : device.wifi === 'joining'
            ? ('connecting' as const)
            : device.wifi === 'error'
              ? ('error' as const)
              : ('no-network' as const)
        : device.connection.status === 'scanning' || device.connection.status === 'connecting'
          ? ('searching' as const)
          : ('no-device' as const),
  };
}
