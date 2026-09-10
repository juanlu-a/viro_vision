/**
 * The operating-mode state machine of ADR 0007, in its app flavour.
 *
 * The canonical diagram lives in `docs/architecture/README.md`; this function transcribes it and
 * the device firmware implements the same machine on top of the physical button. The app models
 * button gestures (click, double click, long press) instead of "switch mode tab" because once the
 * hardware exists the button is what sets the mode and the app only mirrors it — if the app had
 * transitions the button does not, the two surfaces would drift apart.
 *
 * Deliberate note from the diagram: there is NO direct jump between modes. From a mode you can
 * only go back to idle (long press); any other gesture leaves the state where it is.
 */

export const MODES = ['idle', 'bus', 'supermarket'] as const;
export type Mode = (typeof MODES)[number];

export const GESTURES = ['click', 'doubleClick', 'longPress'] as const;
export type Gesture = (typeof GESTURES)[number];

export function transition(mode: Mode, gesture: Gesture): Mode {
  if (gesture === 'longPress') return 'idle';
  if (mode === 'idle' && gesture === 'click') return 'bus';
  if (mode === 'idle' && gesture === 'doubleClick') return 'supermarket';
  return mode;
}
