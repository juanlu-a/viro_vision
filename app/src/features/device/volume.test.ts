import { volumeCommand } from '@/features/device/gatt';

import { clampVolume, createVolumeSender, stepVolume, volumeAtPosition, VOLUME_STEP } from './volume';

/**
 * Exists because the device-volume control is the only way to quiet a speaker that has no buttons
 * (2026-11-18), and its failures are heard, not seen: a command the board rejects leaves it too loud,
 * and a write per tick makes the level bounce as the board's statuses come back out of order.
 */
describe('volumeCommand', () => {
  it('says exactly what the board reads, as a whole number', () => {
    // `int()` on the board rejects "42.5" with an error and the level silently stays where it was.
    expect(volumeCommand(42.5)).toBe('{"cmd":"volume","value":43}');
  });

  it('never sends a level outside 0-100', () => {
    expect(volumeCommand(140)).toBe('{"cmd":"volume","value":100}');
    expect(volumeCommand(-3)).toBe('{"cmd":"volume","value":0}');
  });
});

describe('stepVolume', () => {
  it('moves one step and snaps to the grid', () => {
    expect(stepVolume(50, 1)).toBe(60);
    expect(stepVolume(50, -1)).toBe(40);
    expect(stepVolume(37, 1)).toBe(40);
    expect(stepVolume(37, -1)).toBe(30);
  });

  it('stops at the ends instead of wrapping', () => {
    expect(stepVolume(100, 1)).toBe(100);
    expect(stepVolume(0, -1)).toBe(0);
  });

  it('takes ten steps from silent to full', () => {
    expect(100 / VOLUME_STEP).toBe(10);
  });
});

describe('volumeAtPosition', () => {
  it('maps a touch on the track to a level on the grid', () => {
    expect(volumeAtPosition(0, 200)).toBe(0);
    expect(volumeAtPosition(100, 200)).toBe(50);
    expect(volumeAtPosition(200, 200)).toBe(100);
    expect(volumeAtPosition(250, 200)).toBe(100);
  });

  it('does not divide by zero before the track is laid out', () => {
    expect(volumeAtPosition(10, 0)).toBe(0);
  });
});

describe('clampVolume', () => {
  it('rounds and clamps', () => {
    expect(clampVolume(99.6)).toBe(100);
    expect(clampVolume(-1)).toBe(0);
  });
});

describe('createVolumeSender', () => {
  function fakeTimers() {
    let next: (() => void) | null = null;
    let id = 0;
    return {
      timers: {
        set: (fn: () => void) => {
          next = fn;
          id += 1;
          return id as unknown as ReturnType<typeof setTimeout>;
        },
        clear: () => {
          next = null;
        },
      },
      fire: () => next?.(),
    };
  }

  it('turns a burst of changes into one write with the last level', () => {
    const sent: number[] = [];
    const t = fakeTimers();
    const sender = createVolumeSender((p) => sent.push(p), 400, t.timers);
    sender.push(60);
    sender.push(50);
    sender.push(40);
    t.fire();
    expect(sent).toEqual([40]);
  });

  it('sends nothing once cancelled', () => {
    // Leaving the screen, or the link dropping, must not fire a write at a board that is gone.
    const sent: number[] = [];
    const t = fakeTimers();
    const sender = createVolumeSender((p) => sent.push(p), 400, t.timers);
    sender.push(30);
    sender.cancel();
    t.fire();
    expect(sent).toEqual([]);
  });
});
