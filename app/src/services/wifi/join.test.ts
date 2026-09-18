/**
 * Exists because after joining the AP the phone takes a few seconds to have a route: if
 * `waitForDevice` failed on the first attempt, the flow would say "no connection with the device"
 * exactly when it is about to work; and if it never gave up, a switched-off device would hang the app.
 */
import { NativeModules } from 'react-native';

import { WifiUnavailableError, WifiJoinError, waitForDevice, currentSsid, joinWifi } from './join';

const address = { ip: '10.42.0.1', port: 8080 };

describe('waitForDevice', () => {
  it('retries until the device answers and returns true', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls < 3) throw new Error('no route');
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const ok = await waitForDevice(address, { fetchImpl, sleep: async (ms) => void waits.push(ms), waitMs: 500 });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
    expect(waits).toEqual([500, 500]);
  });

  it('gives up after the configured attempts', async () => {
    const fetchImpl = (async () => ({ ok: false }) as Response) as unknown as typeof fetch;
    const ok = await waitForDevice(address, { fetchImpl, sleep: async () => {}, attempts: 4 });
    expect(ok).toBe(false);
  });
});

describe('currentSsid', () => {
  it('without the native module it returns null instead of failing', async () => {
    expect(await currentSsid()).toBeNull();
  });
});

describe('joinWifi', () => {
  const credentials = { ssid: 'ViroVision', password: 'virovision2026' };

  /** Installs a fake native module for one test, because `nativeModule()` resolves it on every call. */
  function withNativeWifi(connectToProtectedWifiSSID: () => Promise<void>): () => void {
    const modules = NativeModules as unknown as Record<string, unknown>;
    modules.WifiManager = { connectToProtectedWifiSSID, getCurrentWifiSSID: async () => '' };
    return () => delete modules.WifiManager;
  }

  it('without the native module (Expo Go, web, jest) it fails with a typed error and not a TypeError', async () => {
    await expect(joinWifi({ ssid: 'ViroVision', password: 'x' })).rejects.toBeInstanceOf(WifiUnavailableError);
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
    // The 2026-09-18 defect: the library confirms the join by reading back the SSID, which iOS does
    // not hand over without location permission, so it called a join that worked a failure. The app
    // used to announce "could not join" and ask again 15 s later, with the phone already on the AP.
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
