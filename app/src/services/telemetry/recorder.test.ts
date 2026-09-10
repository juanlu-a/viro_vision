/**
 * Exists for two things that, if broken, give no visible error.
 *
 * The first is the **function's contract**: an event with no `type` or no `at` is dropped on the
 * server side and the response is still 200 with `{stored: 0}`. Which means an app that builds the
 * body wrong looks exactly like one that works, and the defect only shows up when someone goes to
 * query the table after a failure and finds nothing.
 *
 * The second is **ADR 0001's boundary rule**: recording cannot throw and cannot make anyone wait. A
 * `fetch` that rejects on a reading's path would take the reading down, which is the exact opposite
 * of what telemetry exists for.
 *
 * The clock, the `fetch` and the timer are injected: a test depending on the real clock would take
 * fifteen seconds per assertion, and one reading `process.env` would measure where it runs and not
 * what it does (the lesson of the TestFlight failure of 2026-09-02).
 */
import { AppState } from 'react-native';

import { MAX_QUEUED } from './queue';
import { generateId, getPhoneId, PHONE_KEY } from './identity';
import { startTelemetry, record, resetTelemetryForTests, flush } from './recorder';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock's factory runs before the imports; require is the documented form of the official mock.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const URL = 'https://example.test/functions/v1/telemetry';

function recordingFetch() {
  const bodies: any[] = [];
  const impl = jest.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return { ok: true, status: 200 } as Response;
  });
  return { impl: impl as unknown as typeof fetch, bodies };
}

/** The timer never fires on its own: each test decides when, or the real clock would rule. */
const schedule = (() => 0 as unknown as ReturnType<typeof setTimeout>) as any;
const cancel = (() => {}) as any;

function start(fetchImpl: typeof fetch, at = '2026-09-09T12:00:00.000Z') {
  return startTelemetry({
    url: URL,
    fetchImpl,
    now: () => new Date(at),
    schedule,
    cancel,
  });
}

afterEach(() => resetTelemetryForTests());

beforeEach(() => {
  (AppState as { currentState: unknown }).currentState = 'active';
});

describe('record', () => {
  it('builds every event with type and at: without those the function drops it and answers 200 all the same', async () => {
    const { impl, bodies } = recordingFetch();
    const stop = start(impl);
    record('reading.ok', { ms: 1234.7, detail: { mode: 'supermarket' } });
    await flush();
    stop();

    expect(bodies).toHaveLength(1);
    const [batch] = bodies;
    expect(batch.phone).toEqual(expect.any(String));
    expect(batch.session).toEqual(expect.any(String));
    expect(batch.events[0]).toEqual({
      type: 'reading.ok',
      at: '2026-09-09T12:00:00.000Z',
      ms: 1234.7,
      // `app` travels on every row since 2026-09-10: without it a reading that happened with the
      // screen locked and one that happened on screen are the same row.
      detail: { app: 'active', mode: 'supermarket' },
    });
  });

  it('with no URL configured it enqueues nothing: telemetry stays off entirely', async () => {
    const { impl, bodies } = recordingFetch();
    const stop = startTelemetry({ url: '', fetchImpl: impl, schedule, cancel });
    record('app.start');
    await flush();
    stop();
    expect(bodies).toHaveLength(0);
  });

  it('an `ms` that is not a finite number does not travel: the function would store it as null and dirty the column', async () => {
    const { impl, bodies } = recordingFetch();
    const stop = start(impl);
    record('photo.ok', { ms: NaN });
    await flush();
    stop();
    expect(bodies[0].events[0]).not.toHaveProperty('ms');
  });

  it('does not throw even when the detail is impossible to serialize (ADR 0001: it cannot take a reading down)', () => {
    const { impl } = recordingFetch();
    const stop = start(impl);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => record('reading.failed', { detail: cyclic })).not.toThrow();
    stop();
  });
});

describe('flush', () => {
  it('does not throw when there is no internet — the NORMAL case joined to the device AP — and keeps the batch', async () => {
    const rejects = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const stop = start(rejects);
    record('ble.connected');
    await expect(flush()).resolves.toBeUndefined();

    // The batch went back to the queue: it uploads once there is network, it is not lost.
    const { impl, bodies } = recordingFetch();
    stop();
    const stop2 = start(impl);
    await flush();
    stop2();
    expect(bodies[0].events.map((e: any) => e.type)).toEqual(['ble.connected']);
  });

  it('a 500 from the server also keeps the batch', async () => {
    const fiveHundred = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const stop = start(fiveHundred);
    record('app.error');
    await flush();
    stop();

    const { impl, bodies } = recordingFetch();
    const stop2 = start(impl);
    await flush();
    stop2();
    expect(bodies[0].events).toHaveLength(1);
  });

  it('a batch the server always rejects is given up for lost: otherwise it blocks all telemetry', async () => {
    const fiveHundred = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const stop = start(fiveHundred);
    record('reading.failed', { detail: { poison: true } });
    // Three attempts at the SAME batch. Without a cap it would return to the queue forever and,
    // since the oldest is always uploaded first, nothing else would ever reach the table.
    await flush();
    await flush();
    await flush();
    stop();

    const { impl, bodies } = recordingFetch();
    const stop2 = start(impl);
    record('reading.ok');
    await flush();
    stop2();

    const types = bodies[0].events.map((e: any) => e.type);
    expect(types).toContain('reading.ok'); // the new one gets through
    expect(types).not.toContain('reading.failed'); // the poisoned batch did not come back
    const notice = bodies[0].events.find((e: any) => e.type === 'app.error');
    expect(notice?.detail?.droppedEvents).toBe(1); // and the loss is declared
  });

  it('after overflowing the queue with no network, the batch that does upload declares how many events were lost', async () => {
    const rejects = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const stop = start(rejects);
    // More than MAX_QUEUED with sending down: it is what happens in a long session joined to the AP.
    for (let i = 0; i < MAX_QUEUED + 60; i++) record('device.status', { detail: { i } });
    // Let the rejections from the threshold-triggered sends resolve.
    await new Promise((r) => setImmediate(r));
    stop();

    const { impl, bodies } = recordingFetch();
    const stop2 = start(impl);
    await flush();
    stop2();

    const notice = bodies[0].events.find((e: any) => e.type === 'app.error');
    expect(notice?.detail?.droppedEvents).toBeGreaterThan(0);
  });
});

describe('identity', () => {
  it('the phone id is stored and reused: without that every start looks like another unit', async () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => memory.get(k) ?? null,
      setItem: async (k: string, v: string) => void memory.set(k, v),
    };
    const first = await getPhoneId(storage as any, () => 0.5);
    const second = await getPhoneId(storage as any, () => 0.9);
    expect(second).toBe(first);
    expect(memory.get(PHONE_KEY)).toBe(first);
  });

  it('when AsyncStorage fails it returns an ephemeral id instead of breaking', async () => {
    const broken = {
      getItem: async () => {
        throw new Error('disk full');
      },
      setItem: async () => {},
    };
    await expect(getPhoneId(broken as any)).resolves.toContain('phone-ephemeral');
  });

  it('the id carries nothing from the system: it is randomness with a prefix', () => {
    expect(generateId('phone', () => 0)).toBe('phone-0000000000000000');
  });
});

/**
 * The app-state stamp and the two flush edges.
 *
 * These exist because of the failure of 2026-09-10: the physical button did nothing with the phone
 * locked, and the table could not say why — every row looks the same whether it was written with
 * the app on screen or with the screen off, and a whole background session's rows could sit in
 * memory until somebody happened to open the app again. Both of those are the difference between
 * diagnosing this and guessing.
 */
describe('the locked screen', () => {
  it('stamps the app state on every event: a background run and a foreground one are otherwise the same timeline', async () => {
    const { impl, bodies } = recordingFetch();
    const stop = start(impl);
    (AppState as { currentState: unknown }).currentState = 'background';
    record('app.start');
    await flush();
    expect(bodies[0].events[0].detail.app).toBe('background');
    stop();
  });

  it('does not clobber a caller that stamps its own app field', async () => {
    const { impl, bodies } = recordingFetch();
    const stop = start(impl);
    record('reading.start', { detail: { app: 'mine', mode: 'supermarket' } });
    await flush();
    expect(bodies[0].events[0].detail).toEqual({ app: 'mine', mode: 'supermarket' });
    stop();
  });

  it('drains the queue when the app comes back to the foreground, not only when it leaves', async () => {
    const handlers: ((state: string) => void)[] = [];
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_event: string, handler: (state: string) => void) => {
        handlers.push(handler);
        return { remove: () => {} };
      }) as any);
    const { impl, bodies } = recordingFetch();
    const stop = start(impl);

    record('reading.ok');
    handlers[0]('active');
    await Promise.resolve();
    await Promise.resolve();

    const types = bodies.flatMap((b: any) => b.events.map((e: any) => e.type));
    expect(types).toContain('reading.ok');
    expect(types).toContain('app.foreground');
    stop();
    spy.mockRestore();
  });
});
