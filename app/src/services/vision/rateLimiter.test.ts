/**
 * The clock and the wait are injected in every case: a test relying on the real `Date.now()` and
 * `setTimeout` would have to wait an actual minute to exercise the sliding window.
 */
import { VisionQuotaError } from './errors';
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

describe('acquireSlot with a wait cap', () => {
  // The bug of 2026-10-06: a 45 s wait announced inside a 12 s reading deadline could never finish.
  it('throws an exhausted quota instead of starting a wait longer than the cap', async () => {
    resetRateLimiter();
    const now = () => 0;
    await acquireSlot('capped', { now, maxPerWindow: 1 });
    let waits = 0;
    await expect(
      acquireSlot('capped', { now, maxPerWindow: 1, maxWaitMs: 5_000, onWait: () => (waits += 1) })
    ).rejects.toBeInstanceOf(VisionQuotaError);
    expect(waits).toBe(0);
  });
});

describe('acquireSlot under the wait cap', () => {
  it('still waits and announces when the wait fits, and reports the seconds when it does not', async () => {
    resetRateLimiter();
    let t = 0;
    const now = () => t;
    await acquireSlot('fits', { now, maxPerWindow: 1 });
    const waits: number[] = [];
    await acquireSlot('fits', {
      now,
      maxPerWindow: 1,
      maxWaitMs: 120_000,
      onWait: (ms) => waits.push(ms),
      sleep: async (ms) => {
        t += ms;
      },
    });
    expect(waits).toHaveLength(1);

    resetRateLimiter();
    t = 0;
    await acquireSlot('tight', { now, maxPerWindow: 1 });
    const err = await acquireSlot('tight', { now, maxPerWindow: 1, maxWaitMs: 1_000 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VisionQuotaError);
    expect((err as VisionQuotaError).retryAfterSeconds).toBeGreaterThan(1);
  });
});
