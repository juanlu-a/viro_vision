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
