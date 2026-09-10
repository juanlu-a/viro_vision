/**
 * Exists because after joining the AP the phone takes a few seconds to have a route: if
 * `waitForDevice` failed on the first attempt, the flow would say "no connection with the device"
 * exactly when it is about to work; and if it never gave up, a switched-off device would hang the app.
 */
import { WifiUnavailableError, waitForDevice, currentSsid, joinWifi } from './join';

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
  it('without the native module (Expo Go, web, jest) it fails with a typed error and not a TypeError', async () => {
    await expect(joinWifi({ ssid: 'ViroVision', password: 'x' })).rejects.toBeInstanceOf(WifiUnavailableError);
  });
});
