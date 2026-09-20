/**
 * Exists because the network policy is where the user pays in prompts and seconds, and both were
 * measured on the phone: a 3 s SSID read that could never answer, a 10 s library poll that called a
 * working join a failure (2026-09-18), and a second "¿Querés unirte?" prompt 15 s later. These tests
 * fix the two promises the policy makes — the system is asked ONLY when the device does not already
 * answer, and the wait ends the moment it answers, not when the library gets around to it — and
 * the retry/give-up shape that keeps a switched-off device from hanging the app.
 */
import { NativeModules } from 'react-native';

import { WifiUnavailableError, WifiJoinError, joinWifi, probeDevice, reachDeviceNetwork } from './join';

const address = { ip: '10.42.0.1', port: 8080 };
const credentials = { ssid: 'ViroVision', password: 'virovision2026' };

/** A probe that answers true from the Nth call on (never, when `from` is Infinity). Counts calls. */
function probeFrom(from: number) {
  const calls: number[] = [];
  return {
    calls,
    probe: async (_a: typeof address, timeoutMs: number) => {
      calls.push(timeoutMs);
      return calls.length >= from;
    },
  };
}

/** A fake clock that the injected `sleep` advances: no real waiting, and `settleMs` is testable. */
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

describe('reachDeviceNetwork', () => {
  it('when the device already answers, the system is never asked (no prompt) and it is ready at once', async () => {
    const { probe, calls } = probeFrom(1);
    const join = jest.fn(async () => 'joined' as const);
    const outcome = await reachDeviceNetwork(address, credentials, { ...clock(), probe, join });
    expect(outcome).toEqual({ ok: true, via: 'already' });
    expect(join).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('the quick check is quick: two short probes, then the system is asked', async () => {
    const { probe, calls } = probeFrom(3);
    const join = jest.fn(async () => 'joined' as const);
    const outcome = await reachDeviceNetwork(address, credentials, { ...clock(), probe, join, quickTimeoutMs: 1_000 });
    expect(outcome).toEqual({ ok: true, via: 'joined' });
    expect(join).toHaveBeenCalledTimes(1);
    // The two quick probes carry the short cap; the ones after the join, the normal one.
    expect(calls.slice(0, 2)).toEqual([1_000, 1_000]);
    expect(calls[2]).toBe(3_000);
  });

  it('is ready the moment the device answers, even if the library has not settled the join yet', async () => {
    // The 2026-09-18 defect: the library spent ten seconds failing to read the SSID before telling
    // us anything. A join that never settles must not hold the network hostage.
    const { probe } = probeFrom(4);
    const join = jest.fn(() => new Promise<'joined'>(() => {}));
    const outcome = await reachDeviceNetwork(address, credentials, { ...clock(), probe, join });
    expect(outcome).toEqual({ ok: true, via: 'joined' });
  });

  it('`unconfirmed` from the library is not a failure: it keeps probing', async () => {
    const { probe } = probeFrom(6);
    const join = jest.fn(async () => 'unconfirmed' as const);
    const outcome = await reachDeviceNetwork(address, credentials, { ...clock(), probe, join });
    expect(outcome).toEqual({ ok: true, via: 'joined' });
  });

  it('a real refusal (the user cancelled, a bad passphrase) ends the wait at once', async () => {
    const { probe, calls } = probeFrom(Infinity);
    const join = jest.fn(async () => {
      throw new WifiJoinError('User denied', 'userDenied');
    });
    const outcome = await reachDeviceNetwork(address, credentials, { ...clock(), probe, join });
    expect(outcome).toEqual({ ok: false, reason: 'refused', message: 'User denied' });
    // Two quick probes, the join, one probe that sees the refusal: no budget spent waiting.
    expect(calls).toHaveLength(3);
  });

  it('without the native module the reason is "unavailable", so the screen can say what build it is', async () => {
    const { probe } = probeFrom(Infinity);
    const join = jest.fn(async () => {
      throw new WifiUnavailableError();
    });
    const outcome = await reachDeviceNetwork(address, credentials, { ...clock(), probe, join });
    expect(outcome).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('after a join the system confirmed, it gives the route a settle window and then gives up', async () => {
    const { probe } = probeFrom(Infinity);
    const join = jest.fn(async () => 'joined' as const);
    const c = clock();
    const outcome = await reachDeviceNetwork(address, credentials, { ...c, probe, join, settleMs: 2_000, intervalMs: 500 });
    expect(outcome).toEqual({ ok: false, reason: 'unreachable', message: '10.42.0.1' });
    // Two quick probes (one interval between), then the settle window: never forever.
    expect(c.now()).toBeLessThan(4_000);
  });

  it('without credentials there is nothing to join: it only probes, within a budget', async () => {
    const { probe } = probeFrom(3);
    const join = jest.fn(async () => 'joined' as const);
    const outcome = await reachDeviceNetwork(address, null, { ...clock(), probe, join });
    expect(outcome).toEqual({ ok: true, via: 'already' });
    expect(join).not.toHaveBeenCalled();

    const never = probeFrom(Infinity);
    const c = clock();
    const gaveUp = await reachDeviceNetwork(address, null, { ...c, probe: never.probe, join, plainMs: 3_000, intervalMs: 1_000 });
    expect(gaveUp).toMatchObject({ ok: false, reason: 'unreachable' });
    expect(c.now()).toBe(3_000);
  });
});

describe('probeDevice', () => {
  it('true only on a 2xx; a thrown fetch (no route) is false, never an exception', async () => {
    const ok = (async () => ({ ok: true }) as Response) as unknown as typeof fetch;
    const down = (async () => ({ ok: false }) as Response) as unknown as typeof fetch;
    const noRoute = (async () => {
      throw new Error('no route');
    }) as unknown as typeof fetch;
    expect(await probeDevice(address, { fetchImpl: ok })).toBe(true);
    expect(await probeDevice(address, { fetchImpl: down })).toBe(false);
    expect(await probeDevice(address, { fetchImpl: noRoute })).toBe(false);
  });
});

describe('joinWifi', () => {
  /** Installs a fake native module for one test, because `nativeModule()` resolves it on every call. */
  function withNativeWifi(connectToProtectedWifiSSID: () => Promise<void>): () => void {
    const modules = NativeModules as unknown as Record<string, unknown>;
    modules.WifiManager = { connectToProtectedWifiSSID };
    return () => delete modules.WifiManager;
  }

  it('without the native module (Expo Go, web, jest) it fails with a typed error and not a TypeError', async () => {
    await expect(joinWifi(credentials)).rejects.toBeInstanceOf(WifiUnavailableError);
  });

  it('when the system confirms it, it is joined', async () => {
    const restore = withNativeWifi(async () => {});
    try {
      await expect(joinWifi(credentials)).resolves.toBe('joined');
    } finally {
      restore();
    }
  });

  it('`unableToConnect` is UNCONFIRMED and not a failure', async () => {
    // The library confirms the join by reading back the SSID, which iOS does not hand over without
    // location permission, so it called a join that worked a failure (2026-09-18).
    const restore = withNativeWifi(async () => {
      throw { code: 'unableToConnect', message: 'Unable to connect to /ViroVision' };
    });
    try {
      await expect(joinWifi(credentials)).resolves.toBe('unconfirmed');
    } finally {
      restore();
    }
  });

  it('a real failure is still a failure', async () => {
    const restore = withNativeWifi(async () => {
      throw { code: 'invalidPassphrase', message: 'Invalid passphrase' };
    });
    try {
      await expect(joinWifi(credentials)).rejects.toBeInstanceOf(WifiJoinError);
    } finally {
      restore();
    }
  });

  it('"already associated" is a join, not an error', async () => {
    const restore = withNativeWifi(async () => {
      throw { message: 'Already associated to ViroVision' };
    });
    try {
      await expect(joinWifi(credentials)).resolves.toBe('joined');
    } finally {
      restore();
    }
  });
});
