/**
 * The operating-mode state machine of ADR 0007, in its app flavour.
 *
 * The canonical diagram lives in `docs/architecture/README.md`; this function transcribes it and
 * the device firmware implements the same machine on top of the physical button. The app models
 * button gestures (click, double click, long press) instead of "switch mode tab" because once the
 * hardware exists the button is what sets the mode and the app only mirrors it — if the app had
 * transitions the button does not, the two surfaces would drift apart.
 *
 * Deliberate note from the diagram (2026-09-09 update of ADR 0007): a gesture names a MODE, not a
 * step. One click is always bus and a double click always supermarket, from wherever the device is,
 * and entering a mode leaves the previous one. Until that date jumping between modes needed a long
 * press in between; with the button soldered, pressing twice and getting nothing reads as a broken
 * button rather than as a missing gesture, and a control that sometimes answers is worse than a
 * simpler one for someone who cannot see the screen.
 */

export const MODES = ['idle', 'bus', 'supermarket'] as const;
export type Mode = (typeof MODES)[number];

export const GESTURES = ['click', 'doubleClick', 'longPress'] as const;
export type Gesture = (typeof GESTURES)[number];

export function transition(mode: Mode, gesture: Gesture): Mode {
  if (gesture === 'longPress') return 'idle';
  if (gesture === 'click') return 'bus';
  if (gesture === 'doubleClick') return 'supermarket';
  return mode;
}

/**
 * Whether the gesture also asks for a reading right now (ADR 0007, 2026-10 update).
 *
 * Two clicks mean "read what is in front of me", not "switch to a mode": in front of the shelf the
 * user repeats the gesture to read the next product, and the second one has to take a photo even
 * though the mode did not change. One click is the opposite kind of gesture — bus mode is
 * surveillance and keeps watching on its own, so repeating it asks for nothing new.
 *
 * It is a separate question from `transition` because the two answers differ: a gesture can name a
 * mode without asking for a reading, and can ask for one without changing the mode. The device
 * mirrors this in `ModeMachine.requests_reading`, and answers it there for the physical button.
 */
export function requestsReading(gesture: Gesture): boolean {
  return gesture === 'doubleClick';
}
