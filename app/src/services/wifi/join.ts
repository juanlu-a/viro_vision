/**
 * Joining the device's access point without the user having to touch Settings (ADR 0003, plan B).
 *
 * It wraps `react-native-wifi-reborn`: on iOS it uses `NEHotspotConfigurationManager` (the first
 * time the system shows a "Do you want to join ViroVision?" prompt that VoiceOver reads; after that
 * it does not ask again), on Android `WifiNetworkSpecifier`. The native module exists neither in
 * Expo Go nor on web: there it fails with a typed error and the app keeps working.
 *
 * RULE (ADR 0003): the device's AP is a **local-only** network, with no gateway; the phone keeps its
 * cellular internet while joined. Measured 2026-09-05: with a gateway, iOS ended up with no internet.
 */
import { NativeModules } from 'react-native';

import type { WifiCredentials } from '@/features/device/gatt';

import { deviceUrl } from './deviceHttp';

export class WifiUnavailableError extends Error {
  constructor() {
    super('WIFI_NOT_AVAILABLE');
    this.name = 'WifiUnavailableError';
  }
}

export class WifiJoinError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null
  ) {
    super(message);
    this.name = 'WifiJoinError';
  }
}

interface NativeWifiManager {
  connectToProtectedWifiSSID(options: { ssid: string; password: string | null; isWEP?: boolean; isHidden?: boolean; timeout?: number }): Promise<void>;
  disconnectFromSSID?(ssid: string): Promise<void>;
  getCurrentWifiSSID(): Promise<string>;
}

/**
 * Every call into the native module carries a time cap. On 2026-09-07 `getCurrentWifiSSID` never
 * answered on iOS (without location permission the system may not reply) and the app stayed on
 * "connecting…" forever: a promise that never comes back is worse than an error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function nativeModule(): NativeWifiManager {
  // Resolved on every call and not at import time: this way the file can be imported (and tested)
  // where the native module does not exist, and it only fails when it is actually used.
  const native = (NativeModules as { WifiManager?: NativeWifiManager }).WifiManager;
  if (!native) throw new WifiUnavailableError();
  return native;
}

export async function joinWifi({ ssid, password }: Pick<WifiCredentials, 'ssid' | 'password'>): Promise<void> {
  const wifi = nativeModule();
  try {
    await withTimeout(
      wifi.connectToProtectedWifiSSID({ ssid, password, isWEP: false, timeout: 20 }),
      25_000,
      () => {
        throw new WifiJoinError('iOS did not answer the join request in 25 s', 'timeout');
      }
    );
  } catch (err) {
    if (err instanceof WifiJoinError) throw err;
    const e = err as { code?: string; message?: string };
    // iOS returns "already associated" when the phone is already on that network: not an error.
    if ((e.message ?? '').toLowerCase().includes('already')) return;
    throw new WifiJoinError(e.message ?? String(err), e.code ?? null);
  }
}

/** Leaves the device's AP; iOS goes back to the known WiFi on its own. Best-effort: if it cannot, nothing happens. */
export async function leaveWifi(ssid: string): Promise<void> {
  try {
    await nativeModule().disconnectFromSSID?.(ssid);
  } catch {
    /* nothing to do: without the device's network the system will return to its own anyway */
  }
}

export async function currentSsid(): Promise<string | null> {
  try {
    return await withTimeout(nativeModule().getCurrentWifiSSID(), 3_000, () => null);
  } catch {
    return null;
  }
}

interface WaitDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  waitMs?: number;
}

/**
 * Waits for the device to answer `/health` at `address`. After joining a WiFi, iOS takes a couple of
 * seconds to have a route and DHCP: it retries instead of failing on the first shot. Pure (fetch and
 * sleep injectable) so the retry policy can be tested without a network.
 */
export async function waitForDevice(
  address: { ip: string; port: number },
  // 300 ms × 30 = 9 s of maximum wait, but the device usually answers on the first or second probe:
  // probing once a second added up to a second of useless wait in a flow meant to feel instant.
  { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), attempts = 30, waitMs = 300 }: WaitDeps = {}
): Promise<boolean> {
  const url = deviceUrl(address, '/health');
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const r = await fetchImpl(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (r.ok) return true;
    } catch {
      /* not yet: retry */
    }
    if (i < attempts - 1) await sleep(waitMs);
  }
  return false;
}
