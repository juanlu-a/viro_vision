/**
 * Joining the device's access point without the user having to touch Settings (ADR 0003, plan B).
 *
 * It wraps `react-native-wifi-reborn`: on iOS it uses `NEHotspotConfigurationManager`, on Android
 * `WifiNetworkSpecifier`. The native module exists neither in Expo Go nor on web: there it fails
 * with a typed error and the app keeps working.
 *
 * RULE (ADR 0003): the device's AP is a **local-only** network, with no gateway; the phone keeps its
 * cellular internet while joined. Measured 2026-09-05: with a gateway, iOS ended up with no internet.
 *
 * THE PROMPT. iOS shows "¿Querés unirte a ViroVision?" **every time** `applyConfiguration` is called
 * while the phone is not on that network — the configuration being persisted from a previous time
 * does not spare it (2026-09-19: the second call of the day prompted again). It is a system alert
 * and there is no API to suppress it, so the only way to give the user zero prompts after the first
 * pairing is to **not call it**: find out whether the phone is already on the network, and only ask
 * the system when it is not. That is `reachDeviceNetwork`, and it is why nothing in this file ever
 * removes the configuration either — a forgotten network is a prompt on the next connection.
 *
 * WHY THE PROOF IS HTTP AND NOT THE SSID. The obvious check — read the current SSID — does not
 * work here. On iOS the library hands the SSID over only with location permission, which this app
 * does not ask for (one more permission to explain to a blind person, for a string we do not need):
 * without it `getCurrentWifiSSID` never answers (2026-09-07) and the library's own post-join poll,
 * which reads the SSID 20 times, cannot ever succeed — it waits ten seconds and calls a join that
 * worked a failure (2026-09-18). The device answering `/health` at its own IP is proof the phone is
 * on its network, needs no permission and takes ~50 ms. It is the only evidence this file trusts.
 */
import { NativeModules } from 'react-native';

import type { WifiCredentials } from '@/features/device/gatt';

import { deviceUrl, type DeviceAddress } from './deviceHttp';

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

export type JoinOutcome = 'joined' | 'unconfirmed';

/**
 * Errors that mean "the join was not CONFIRMED", never "the join failed".
 *
 * After `applyConfiguration` succeeds, the library polls the current SSID 20 times every 0.5 s and
 * rejects with `unableToConnect` when it never reads back the SSID it asked for (`RNWifi.m`,
 * `connectToProtectedSSIDOnce`). Reading the SSID on iOS needs location permission (see the module
 * doc), so on this app the poll CANNOT succeed: it waits its ten seconds and calls a join that
 * worked a failure. Measured 2026-09-18: prompt, accepted, phone joined, and ten seconds later the
 * app announced "could not join"; the next heartbeat asked again and "the second time it worked" —
 * it had been joined the whole time.
 */
const UNCONFIRMED_CODES = new Set([
  'unableToConnect',
  'couldNotDetectSSID',
  'locationPermissionDenied',
  'locationPermissionRestricted',
]);

/**
 * Asks the system to join the device's AP. This is the call that shows the prompt.
 *
 * Returns `'joined'` when the system confirmed it and `'unconfirmed'` when it could not tell us —
 * which is NOT a failure and must not be announced as one. Whether there is a network is decided by
 * the device answering (`reachDeviceNetwork`). What is thrown is a real refusal: the user tapped
 * Cancel, a wrong passphrase, no native module.
 */
export async function joinWifi({ ssid, password }: Pick<WifiCredentials, 'ssid' | 'password'>): Promise<JoinOutcome> {
  const wifi = nativeModule();
  try {
    await withTimeout(
      wifi.connectToProtectedWifiSSID({ ssid, password, isWEP: false, timeout: 20 }),
      25_000,
      () => {
        throw new WifiJoinError('iOS did not answer the join request in 25 s', 'timeout');
      }
    );
    return 'joined';
  } catch (err) {
    if (err instanceof WifiJoinError) throw err;
    const e = err as { code?: string; message?: string };
    // iOS returns "already associated" when the phone is already on that network: not an error.
    if ((e.message ?? '').toLowerCase().includes('already')) return 'joined';
    if (e.code && UNCONFIRMED_CODES.has(e.code)) return 'unconfirmed';
    throw new WifiJoinError(e.message ?? String(err), e.code ?? null);
  }
}

interface ProbeDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * One GET to the device's `/health`. True when it answers: the phone has a route to the device.
 *
 * The cap matters more than it looks. While the phone is on another network, a packet to
 * 10.42.0.1 has nowhere to go and the request can hang until the socket gives up; the cap is what
 * keeps a probe that is going to fail from costing seconds.
 */
export async function probeDevice(address: DeviceAddress, { fetchImpl = fetch, timeoutMs = 3_000 }: ProbeDeps = {}): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetchImpl(deviceUrl(address, '/health'), { signal: controller.signal, cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type NetworkOutcome =
  /** The device answers. `via` says whether the system had to be asked (= the user saw a prompt). */
  | { ok: true; via: 'already' | 'joined' }
  | { ok: false; reason: 'unavailable' | 'refused' | 'unreachable'; message: string };

interface ReachDeps {
  probe?: (address: DeviceAddress, timeoutMs: number) => Promise<boolean>;
  join?: typeof joinWifi;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Cheap check before asking the system: two quick probes. Pays ~1 s at most, saves a prompt. */
  quickAttempts?: number;
  quickTimeoutMs?: number;
  /** How long to keep probing after the system said it joined: DHCP and the route take a moment. */
  settleMs?: number;
  /** Probe-only budget, for a device on the same network as the phone (no AP, nothing to join). */
  plainMs?: number;
  intervalMs?: number;
}

/**
 * Gets the phone onto the device's network with as few prompts as physically possible, and says
 * how it went. Pure: every dependency is injectable, so the policy is tested without a radio.
 *
 * 1. **Probe first.** If the device already answers — the phone never left the network, or iOS
 *    auto-joined the persisted configuration — it is ready in ~50 ms and the system is not asked
 *    anything. This is the whole "no prompt the second time".
 * 2. **Otherwise ask the system, and keep probing meanwhile.** The join is declared done the moment
 *    the device answers, not when the library's promise settles: that promise spends ten seconds
 *    failing to read an SSID it is not allowed to read (see `joinWifi`), and the user was sitting
 *    through all of it. The promise is only listened to for a real refusal (the user cancelled, a
 *    wrong passphrase), which ends the wait at once instead of after the budget.
 *
 * Without credentials there is nothing to join: the device is on the same network as the phone
 * (development mode) and it either answers or it does not.
 */
export async function reachDeviceNetwork(
  target: DeviceAddress,
  credentials: Pick<WifiCredentials, 'ssid' | 'password'> | null,
  {
    probe = (address, timeoutMs) => probeDevice(address, { timeoutMs }),
    join = joinWifi,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    quickAttempts = 2,
    quickTimeoutMs = 1_000,
    settleMs = 8_000,
    plainMs = 9_000,
    intervalMs = 300,
  }: ReachDeps = {}
): Promise<NetworkOutcome> {
  const unreachable = (): NetworkOutcome => ({ ok: false, reason: 'unreachable', message: target.ip });

  if (!credentials) {
    const deadline = now() + plainMs;
    while (true) {
      if (await probe(target, 3_000)) return { ok: true, via: 'already' };
      if (now() >= deadline) return unreachable();
      await sleep(intervalMs);
    }
  }

  for (let i = 0; i < quickAttempts; i++) {
    if (await probe(target, quickTimeoutMs)) return { ok: true, via: 'already' };
    if (i < quickAttempts - 1) await sleep(intervalMs);
  }

  // The join runs on its own; the loop below only looks at how it ended. Settled here and not
  // awaited: an `await` would be the ten seconds this function exists to remove. The `then` also
  // keeps the promise from ever rejecting unhandled once the loop has stopped caring.
  const request: { settled: { at: number; error: unknown | null } | null } = { settled: null };
  void join(credentials).then(
    () => {
      request.settled = { at: now(), error: null };
    },
    (err: unknown) => {
      request.settled = { at: now(), error: err };
    }
  );

  while (true) {
    if (await probe(target, 3_000)) return { ok: true, via: 'joined' };
    const done = request.settled;
    if (done?.error) {
      const err = done.error;
      if (err instanceof WifiUnavailableError) return { ok: false, reason: 'unavailable', message: err.message };
      return { ok: false, reason: 'refused', message: err instanceof Error ? err.message : String(err) };
    }
    if (done && now() - done.at >= settleMs) return unreachable();
    await sleep(intervalMs);
  }
}
