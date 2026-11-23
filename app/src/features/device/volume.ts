/**
 * The policy behind the device-volume control in Settings (2026-11-18), kept out of the component so
 * it can be tested: there is no `@testing-library/react-native` in this repo.
 *
 * The device has no volume buttons, and once the amplifier went in (ADR 0012, update of 2026-11-18)
 * its fixed startup level was far too loud on a bone-conduction transducer. This is the only way the
 * person wearing it can change that.
 */

/**
 * One screen-reader increment, and one press of the − / + buttons. Ten steps from silent to full:
 * fine enough to land on a comfortable level, coarse enough that a VoiceOver user does not swipe
 * fifty times — and each step is audible, which is the only feedback that matters here.
 */
export const VOLUME_STEP = 10;

/**
 * How long the control waits after the last change before writing to the board. A burst of swipes or
 * presses becomes one BLE write: each write runs `amixer` on the board and pushes a new `status`, and
 * sending one per tick would make the slider jump back to an older level as those statuses arrive.
 */
export const VOLUME_SEND_DELAY_MS = 400;

export function clampVolume(percent: number): number {
  return Math.round(Math.max(0, Math.min(100, percent)));
}

/** The level one step up or down, snapped to the step grid so 37 → + lands on 40, not 47. */
export function stepVolume(current: number, direction: 1 | -1): number {
  const snapped = direction > 0 ? Math.floor(current / VOLUME_STEP) + 1 : Math.ceil(current / VOLUME_STEP) - 1;
  return clampVolume(snapped * VOLUME_STEP);
}

/** The level for a touch at `x` along a track `width` wide, rounded to the step grid. */
export function volumeAtPosition(x: number, width: number): number {
  if (width <= 0) return 0;
  return clampVolume(Math.round(((x / width) * 100) / VOLUME_STEP) * VOLUME_STEP);
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Calls `send` once, `delayMs` after the last `push`, with the last value pushed. Timers are
 * injectable so the test does not wait in real time.
 */
export function createVolumeSender(
  send: (percent: number) => void,
  delayMs: number = VOLUME_SEND_DELAY_MS,
  timers: { set: (fn: () => void, ms: number) => Timer; clear: (t: Timer) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (t) => clearTimeout(t),
  }
) {
  let pending: Timer | null = null;
  return {
    push(percent: number) {
      if (pending) timers.clear(pending);
      pending = timers.set(() => {
        pending = null;
        send(clampVolume(percent));
      }, delayMs);
    },
    cancel() {
      if (pending) timers.clear(pending);
      pending = null;
    },
  };
}
