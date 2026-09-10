/**
 * Exists because the firmware implements THIS SAME machine on top of the physical button
 * (ADR 0007): if the app and `hardware/raspi/virovision/modes.py` disagree on a single cell, app
 * and device start telling the user different stories and no screen gives it away. The table
 * replicates the canonical diagram in `docs/architecture/README.md` case by case; on disagreement,
 * the diagram wins.
 */
import { GESTURES, MODES, requestsReading, transition } from './modes';
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

describe('requestsReading', () => {
  /**
   * Exists because this is the half of the button contract that `transition` cannot express: a
   * double click in supermarket changes NO mode and still has to take a photo. Before the
   * 2026-10 update the capture was keyed off the mode transition, so the second double click in
   * front of the shelf did nothing and the button read as broken.
   */
  it('a double click always asks for a reading', () => {
    expect(requestsReading('doubleClick')).toBe(true);
  });

  it('a single click does not: bus mode keeps watching on its own', () => {
    // If this ever returned true, every click would cost a photo and a cloud call.
    expect(requestsReading('click')).toBe(false);
  });

  it('a long press does not: it is how you leave, not how you read', () => {
    expect(requestsReading('longPress')).toBe(false);
  });

  it('asking for a reading is independent of changing mode', () => {
    // The device mirrors this pair in `ModeMachine.requests_reading`; if the two answers ever
    // collapsed into one, a repeated double click would go back to doing nothing.
    expect(transition('supermarket', 'doubleClick')).toBe('supermarket');
    expect(requestsReading('doubleClick')).toBe(true);
  });
});
