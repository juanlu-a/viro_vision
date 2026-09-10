/**
 * The clock and the wait are injected in every case: a test relying on the real `Date.now()` and
 * `setTimeout` would have to wait an actual minute to exercise the sliding window.
 */
import { acquireSlot, remainingSlots, resetRateLimiter } from './rateLimiter';

afterEach(resetRateLimiter);

/** Fake clock: it only advances when the test asks it to. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('acquireSlot', () => {
  it('lets calls through without waiting while there is room in the window', async () => {
    const clock = fakeClock();
    let waits = 0;

    for (let i = 0; i < 3; i += 1) {
      await acquireSlot('model', { now: clock.now, maxPerWindow: 3, onWait: () => (waits += 1) });
    }

    expect(waits).toBe(0);
    expect(remainingSlots('model', clock.now(), 3)).toBe(0);
  });

  it('each model keeps its own count', async () => {
    const clock = fakeClock();
    await acquireSlot('flash', { now: clock.now, maxPerWindow: 1 });

    // If the counts got mixed up, this would have to wait instead of going straight through.
    let waited = false;
    await acquireSlot('flash-lite', {
      now: clock.now,
      maxPerWindow: 1,
      onWait: () => (waited = true),
    });

    expect(waited).toBe(false);
  });

  it('frees the slot when the send leaves the window', async () => {
    const clock = fakeClock();
    await acquireSlot('model', { now: clock.now, maxPerWindow: 1 });
    expect(remainingSlots('model', clock.now(), 1)).toBe(0);

    clock.advance(60_001);

    let waited = false;
    await acquireSlot('model', {
      now: clock.now,
      maxPerWindow: 1,
      onWait: () => (waited = true),
    });

    expect(waited).toBe(false);
  });

  it('reports how long to wait and only sends once the slot frees up', async () => {
    const clock = fakeClock();
    await acquireSlot('model', { now: clock.now, maxPerWindow: 1 });

    clock.advance(20_000);

    const notices: number[] = [];
    await acquireSlot('model', {
      now: clock.now,
      maxPerWindow: 1,
      onWait: (ms) => notices.push(ms),
      // "Sleeping" advances the fake clock instead of actually waiting.
      sleep: async (ms) => clock.advance(ms),
    });

    // 20 s of the window's minute have already passed: ~40 s left plus the limiter's margin.
    expect(notices).toHaveLength(1);
    expect(notices[0]).toBeGreaterThan(39_000);
    expect(notices[0]).toBeLessThan(41_000);
  });

  it('cuts the wait short when the run is cancelled', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    await acquireSlot('model', { now: clock.now, maxPerWindow: 1 });

    // Without the `aborted` check at the top of every turn, this would spin forever: the fake clock
    // does not advance on its own and nobody is going to free the slot.
    await acquireSlot('model', {
      now: clock.now,
      maxPerWindow: 1,
      signal: controller.signal,
      onWait: () => controller.abort(),
      sleep: async () => {},
    });
  });
});

describe('remainingSlots', () => {
  it('starts with the whole window available', () => {
    expect(remainingSlots('model', 1_000_000)).toBe(17);
  });
});
