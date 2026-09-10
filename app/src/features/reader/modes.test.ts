/**
 * Exists because the firmware implements THIS SAME machine on top of the physical button
 * (ADR 0007): if someone adds a transition to the app that the button does not have —the direct
 * jump between modes being the obvious temptation—, app and device start telling the user
 * different stories and no screen gives it away. The table replicates the canonical diagram in
 * `docs/architecture/README.md` case by case; on disagreement, the diagram wins.
 */
import { GESTURES, MODES, transition } from './modes';
import type { Gesture, Mode } from './modes';

describe('transition', () => {
  const expected: Record<Mode, Record<Gesture, Mode>> = {
    idle: { click: 'bus', doubleClick: 'supermarket', longPress: 'idle' },
    bus: { click: 'bus', doubleClick: 'bus', longPress: 'idle' },
    supermarket: { click: 'supermarket', doubleClick: 'supermarket', longPress: 'idle' },
  };

  for (const mode of MODES) {
    for (const gesture of GESTURES) {
      it(`${mode} + ${gesture} → ${expected[mode][gesture]}`, () => {
        expect(transition(mode, gesture)).toBe(expected[mode][gesture]);
      });
    }
  }

  it('does not allow jumping from one mode to the other without passing through idle', () => {
    expect(transition('bus', 'doubleClick')).not.toBe('supermarket');
    expect(transition('supermarket', 'click')).not.toBe('bus');
  });
});
