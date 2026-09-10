/**
 * Exists because the firmware implements THIS SAME machine on top of the physical button
 * (ADR 0007): if the app and `hardware/raspi/virovision/modes.py` disagree on a single cell, app
 * and device start telling the user different stories and no screen gives it away. The table
 * replicates the canonical diagram in `docs/architecture/README.md` case by case; on disagreement,
 * the diagram wins.
 */
import { GESTURES, MODES, transition } from './modes';
import type { Gesture, Mode } from './modes';

describe('transition', () => {
  const expected: Record<Mode, Record<Gesture, Mode>> = {
    idle: { click: 'bus', doubleClick: 'supermarket', longPress: 'idle' },
    bus: { click: 'bus', doubleClick: 'supermarket', longPress: 'idle' },
    supermarket: { click: 'bus', doubleClick: 'supermarket', longPress: 'idle' },
  };

  for (const mode of MODES) {
    for (const gesture of GESTURES) {
      it(`${mode} + ${gesture} → ${expected[mode][gesture]}`, () => {
        expect(transition(mode, gesture)).toBe(expected[mode][gesture]);
      });
    }
  }

  // 2026-09-09 update of ADR 0007. The previous version of this test asserted the opposite: that
  // there was NO direct jump. It is kept inverted, and not deleted, because the temptation now runs
  // the other way — someone restoring the guard would silently bring back the behaviour that read
  // as a broken button in the user's hand.
  it('jumps straight between modes: a gesture names a mode, not a step', () => {
    expect(transition('bus', 'doubleClick')).toBe('supermarket');
    expect(transition('supermarket', 'click')).toBe('bus');
  });

  it('a long press always leaves, from any mode', () => {
    for (const mode of MODES) expect(transition(mode, 'longPress')).toBe('idle');
  });
});
