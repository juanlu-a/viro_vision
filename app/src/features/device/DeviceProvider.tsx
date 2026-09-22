/**
 * The device, shared by the whole app: BLE connection, the device's WiFi network and the mode.
 *
 * It is a Provider and not a per-screen hook for the same reason as `ProductModelProvider`: the
 * Device screen shows the state, Home reads with the device's camera, and both have to see THE SAME
 * connection. And because the connection has to exist even if the user never opens Device: turning
 * the device on is all they do (ADR 0003).
 *
 * What it does on its own:
 * - **Connects over BLE at startup and reconnects** when the link drops (with growing backoff). The
 *   only permission the user sees is the system's Bluetooth one, the first time.
 * - **Joins the device's WiFi** with the credentials that arrive over BLE, and only when the phone
 *   is not already on it: the system's "join this network?" prompt is shown at most once per phone,
 *   the first time (`services/wifi/join.ts` says why the check is an HTTP probe). Zero configuration,
 *   and the network is never forgotten on purpose — forgetting it is what brings the prompt back.
 * - **Keeps the mode in sync**: the app writes it to the device and mirrors whatever the device
 *   reports.
 *
 * BOUNDARY RULE (ADR 0001): none of this is on the bus recognition path, which runs locally. What
 * does go out to the network is **telemetry**: it is recorded here and not in `features/audio` or
 * `features/recognition`, where the linter forbids it, and always without awaiting it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { notify } from '@/features/audio/systemNotice';
import type { AudioOutput } from '@/features/audio/audioOutput';
import { strings } from '@/i18n';
import {
  BleDeviceNotFoundError,
  BleNotImplementedError,
  getBleClient,
} from '@/services/ble/bleClient';
import { encodeBase64 } from '@/services/ble/base64';
import { downloadDevicePhoto, type DevicePhoto } from '@/services/camera';
import { record } from '@/services/telemetry';
import { deviceUrl, type DeviceAddress } from '@/services/wifi/deviceHttp';
import { reachDeviceNetwork } from '@/services/wifi/join';

import { MODE_FROM_GATT, GATT_MODE, type DeviceStatus, type WifiCredentials } from './gatt';
import type { ConnectionState, DeviceInfo } from './types';

export type WifiState = 'off' | 'joining' | 'ready' | 'error';
export type DeviceMode = (typeof MODE_FROM_GATT)[number];
export type { DeviceAddress };

interface DeviceValue {
  connection: ConnectionState;
  /** Where the device is on the network right now (it changes when it turns its AP on). */
  address: DeviceAddress | null;
  wifi: WifiState;
  /** Why the network is in error, for the screen and the voice; null when there is no error. */
  wifiDetail: string | null;
  /** The last error notice the device sent over BLE, or null. */
  lastNotice: string | null;
  /** True when a photo can be requested over WiFi: connected, with a network and `/health` answering. */
  photoAvailable: boolean;
  /** True while the device is an access point (with a mode active). */
  ap: boolean;
  /** The last mode reported by the device, or null when it reported none. */
  deviceMode: DeviceMode | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  writeMode: (mode: DeviceMode) => Promise<void>;
  /** Tells the device where bus readings should be heard. Best-effort: it never throws. */
  writeAudioTarget: (target: AudioOutput) => Promise<void>;
  downloadPhoto: (options?: { timeoutMs?: number }) => Promise<DevicePhoto>;
  /** Sends a reading's MP3 to the device's speaker. Best-effort: it never throws. */
  sendAudio: (uri: string) => Promise<boolean>;
}

const DeviceContext = createContext<DeviceValue | null>(null);

const initialConnection: ConnectionState = { status: 'idle', device: null, message: strings.connection.idle };

// Reconnection: fast at first (the device has just rebooted), then without insisting (phone battery).
const RETRIES_MS = [3_000, 5_000, 10_000, 20_000, 30_000];

function errorMessage(err: unknown): string {
  if (err instanceof BleNotImplementedError) return strings.connection.unavailable;
  if (err instanceof BleDeviceNotFoundError) return strings.connection.notFound;
  return strings.connection.error;
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<ConnectionState>(initialConnection);
  const [address, setAddress] = useState<DeviceAddress | null>(null);
  const [ap, setAp] = useState(false);
  const [wifi, setWifi] = useState<WifiState>('off');
  const [wifiDetail, setWifiDetail] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<DeviceMode | null>(null);

  const credentials = useRef<WifiCredentials | null>(null);
  const autoConnect = useRef(true);
  const retry = useRef(0);
  const connecting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The connect function is referenced from the retry timer, which is defined before it: that is why
  // it goes in a ref instead of being captured directly.
  const connectRef = useRef<() => Promise<void>>(async () => {});
  const networkSyncRun = useRef(0);
  // The last thing synced, so the check does not restart with every `status` heartbeat — nor while
  // one is still running: a restart would cancel a join that is about to succeed and, worse, ask the
  // system again, which is a second prompt on top of the first (2026-09-19).
  const syncedNetwork = useRef<{ ap: boolean; ip: string | null; ok: boolean; running: boolean }>({ ap: false, ip: null, ok: false, running: false });
  // The last `status` recorded, so the table does not fill with identical heartbeats.
  const statusFingerprint = useRef<string | null>(null);
  /**
   * Whether the user has already been told the network is ready, for the network it is ready ON.
   *
   * Because they were told twice in the field (2026-09-13). The network check legitimately runs more
   * than once for one connection — once from `connectInternal` and again from the first `status`
   * that brings the device's address — and each run that reaches the end announces. The `run`
   * counter does not catch it: it only discards a run that was SUPERSEDED, and these two do not
   * overlap, the second starts after the first finished.
   *
   * Saying the same sentence twice is not cosmetic here. The voice is the whole interface, so a
   * repeated announcement is indistinguishable from a second event having happened — and the user is
   * being trained to count announcements to know what the device is doing.
   */
  const announcedReadyFor = useRef<string | null>(null);

  /**
   * The network follows the AP: join when the device has one up, and check that the device answers
   * before declaring the photo available. It is called from the event handlers (connection, new
   * status), never from an effect. Every run carries a number: if the situation changed while it
   * waited, its results are discarded.
   */
  const failNetwork = useCallback((detail: string) => {
    // Cleared here and on every other way out of `ready` below: the guard must suppress a repeated
    // announcement, never a real one. A network that failed and came back has to be announced again.
    announcedReadyFor.current = null;
    setWifi('error');
    setWifiDetail(detail);
    record('wifi.failed', { detail: { reason: detail } });
    // Voice is the interface: a silent failure leaves the user waiting for a button that never comes.
    // Out of whatever output the user chose (`features/audio/systemNotice.ts`): the BLE link is up —
    // it is how we learned the AP exists — so the board can say it even though its WiFi is what failed.
    void notify('networkFailed', detail);
  }, []);

  const syncNetwork = useCallback(
    async (apOn: boolean, target: DeviceAddress | null): Promise<boolean> => {
      const run = ++networkSyncRun.current;
      const current = () => run === networkSyncRun.current;
      setWifiDetail(null);
      if (!target) {
        announcedReadyFor.current = null;
        setWifi('off');
        return false;
      }
      if (apOn && !credentials.current) {
        // The device turned its AP on but the app has no credentials for it: almost always it is
        // iOS's GATT cache serving a characteristics list from before `wifi` existed (2026-09-05). It
        // is read once more; if it is still empty, the user is told the remedy, which is theirs.
        credentials.current = await getBleClient().readWifi().catch(() => null);
        if (!current()) return false;
        if (!credentials.current) {
          failNetwork(strings.connect.wifiNoCredentials);
          return false;
        }
      }
      setWifi('joining');
      record('wifi.joining', { detail: { ap: apOn, ip: target.ip, ssid: apOn ? (credentials.current?.ssid ?? null) : null } });
      const t0 = Date.now();
      // With the AP on, the credentials are the phone's ticket in; without it the device is on the
      // same network as the phone (development) and there is nothing to join, only to reach.
      const outcome = await reachDeviceNetwork(target, apOn ? credentials.current : null);
      if (!current()) return false;
      if (outcome.ok) {
        setWifi('ready');
        // The time until the device answers is what separates "it is slow" from "it does not work":
        // on 2026-09-06 the network never became ready and without this number there was no way to
        // know where it hung. `via` says whether the user saw a prompt: 'already' is the one the
        // second connection is supposed to be, every time.
        record('wifi.ready', { ms: Date.now() - t0, detail: { ip: target.ip, via: outcome.via } });
        // Announced once per network, not once per check (see `announcedReadyFor`). The row above is
        // still recorded every time: a second check reaching "ready" is worth knowing about in the
        // table, it is just not worth saying out loud again.
        if (announcedReadyFor.current !== target.ip) {
          announcedReadyFor.current = target.ip;
          void notify('networkReady');
        }
        return true;
      }
      failNetwork(
        outcome.reason === 'unavailable'
          ? strings.connect.wifiModuleMissing
          : outcome.reason === 'refused'
            ? `${strings.connect.wifiJoinFailed} ${outcome.message}`
            : strings.connect.wifiNoResponse.replace('{ip}', target.ip)
      );
      return false;
    },
    [failNetwork]
  );

  /**
   * Starts a network check only when there is something new to check.
   *
   * Both callers go through here — the fresh connection and every `status` heartbeat — so the
   * rule is written once: sync when the AP or the address changed, or when the last check failed
   * and none is running. A check already in flight is left alone even by the caller that would
   * otherwise "own" it (the first heartbeat can land while `connectInternal` is still reading the
   * credentials): restarting it would cancel a join about to succeed and ask the system for a
   * second prompt on top of the first.
   */
  const ensureNetwork = useCallback(
    (apOn: boolean, target: DeviceAddress | null) => {
      const previous = syncedNetwork.current;
      const changed = previous.ap !== apOn || previous.ip !== (target?.ip ?? null);
      if (!changed && (previous.ok || previous.running)) return;
      const synced = { ap: apOn, ip: target?.ip ?? null, ok: false, running: true };
      syncedNetwork.current = synced;
      void syncNetwork(apOn, target).then((ok) => {
        if (syncedNetwork.current !== synced) return; // superseded: its verdict is not ours to keep
        synced.running = false;
        synced.ok = ok;
      });
    },
    [syncNetwork]
  );

  /**
   * The device announces over BLE that its AP is changing BEFORE it switches networks: from that
   * instant the old address is useless and the device button has to disappear until `status` brings
   * the new one and `/health` answers. Without this, a tap during those seconds died waiting 20 s
   * (2026-09-05, first run of the flow).
   */
  const startNetworkTransition = useCallback(() => {
    announcedReadyFor.current = null;
    networkSyncRun.current += 1;
    syncedNetwork.current = { ap: false, ip: null, ok: false, running: false };
    setAddress(null);
    setWifi('joining');
    setWifiDetail(null);
  }, []);

  const applyStatus = useCallback(
    (status: DeviceStatus) => {
      const target = status.ip && status.port ? { ip: status.ip, port: status.port } : null;
      // `status` arrives every 15 s: recording it whole would be 240 rows an hour of which 239 are
      // identical. It is recorded only when something worth looking at later changes, and the battery
      // in 5 % steps so discharging does not produce a row per heartbeat.
      const fingerprint = JSON.stringify([
        status.ap, status.wifi, status.camera, status.ip, status.version,
        status.battery == null ? null : Math.round(status.battery / 5),
      ]);
      if (fingerprint !== statusFingerprint.current) {
        statusFingerprint.current = fingerprint;
        record('device.status', { detail: { ...status } });
      }
      setAp(status.ap);
      setAddress(target);
      setConnection((c) =>
        c.device ? { ...c, device: { ...c.device, batteryLevel: status.battery, firmwareVersion: status.version } } : c
      );
      // `status` arrives every 15 s. Restarting the network check on every heartbeat cancelled the
      // previous one before it finished and the network never became "ready" (2026-09-06):
      // `ensureNetwork` only syncs when something changed, or when it was left in a failed state.
      ensureNetwork(status.ap, target);
    },
    [ensureNetwork]
  );

  const scheduleRetry = useCallback(() => {
    if (!autoConnect.current || timer.current) return;
    const wait = RETRIES_MS[Math.min(retry.current, RETRIES_MS.length - 1)];
    record('ble.retry', { ms: wait, detail: { attempt: retry.current + 1 } });
    retry.current += 1;
    timer.current = setTimeout(() => {
      timer.current = null;
      void connectRef.current();
    }, wait);
  }, []);

  const connectInternal = useCallback(async () => {
    if (connecting.current) return;
    connecting.current = true;
    setConnection({ status: 'scanning', device: null, message: strings.connection.scanning });
    record('ble.scanning');
    const t0 = Date.now();
    try {
      const client = getBleClient();
      const device: DeviceInfo = await client.connect();
      retry.current = 0;
      // How long it took to show up, and in what state: it is the context for everything that comes
      // later in the session.
      record('ble.connected', {
        ms: Date.now() - t0,
        detail: {
          name: device.name,
          firmware: device.firmwareVersion,
          battery: device.batteryLevel,
          ap: device.ap,
          withNetwork: device.address !== null,
        },
      });
      setConnection({ status: 'connected', device, message: strings.connection.connected });
      // Said out loud since 2026-09-16. Until then the link coming up was only a label on the Device
      // tab, so the only way to learn about it was to look at the screen — which is the one thing
      // this app's user cannot do. It is announced from here and not from an effect on `status` so a
      // re-render cannot say it twice.
      void notify('connected');
      setAddress(device.address);
      setAp(device.ap);
      credentials.current = await client.readWifi().catch(() => null);
      ensureNetwork(device.ap, device.address);
    } catch (err) {
      // The error's TYPE, not just its message: it tells "this build has no Bluetooth" apart from
      // "the device did not show up", which lead to different places.
      record('ble.failed', {
        ms: Date.now() - t0,
        detail: {
          type: err instanceof Error ? err.name : typeof err,
          message: err instanceof Error ? err.message : String(err),
        },
      });
      setConnection({ status: 'error', device: null, message: errorMessage(err) });
      // With no native module there is nothing to retry: the app runs without the device.
      if (!(err instanceof BleNotImplementedError)) scheduleRetry();
    } finally {
      connecting.current = false;
    }
  }, [scheduleRetry, ensureNetwork]);

  useEffect(() => {
    connectRef.current = connectInternal;
  }, [connectInternal]);

  // Client subscriptions, once.
  useEffect(() => {
    const client = getBleClient();
    const unsubscribes = [
      client.onDisconnect(() => {
        record('ble.lost');
        announcedReadyFor.current = null;
        networkSyncRun.current += 1; // invalidates any network wait in flight
        // And forgets what was synced: the next connection has to check the network again even if
        // the device comes back with the very same address, or `wifi` stays 'off' for good.
        syncedNetwork.current = { ap: false, ip: null, ok: false, running: false };
        setConnection({ status: 'error', device: null, message: strings.connection.lost });
        // The counterpart, and the more important of the two: from here the button does nothing and
        // no reading is coming, and without a word the user is left waiting for audio that will
        // never arrive. It goes to the phone by force of the rule, not by exception — the link it is
        // reporting on is the one the board would have needed to say it.
        void notify('connectionLost');
        setAddress(null);
        setAp(false);
        setWifi('off');
        scheduleRetry();
      }),
      client.onStatus(applyStatus),
      client.onMode((value) => {
        record('device.mode', { detail: { value, mode: MODE_FROM_GATT[value] ?? null } });
        setDeviceMode(MODE_FROM_GATT[value] ?? null);
      }),
      client.onAp(startNetworkTransition),
      // Recorded here and not where it is served: this is the moment the user's finger asked for
      // it, and the gap against the `reading.start` that follows is what says whether the device or
      // the app is the slow half. **Serving it is no longer this provider's job**: `features/reader`
      // subscribes to the client itself (see `ReaderBridge`), because a hardware interrupt that has
      // to travel through React state before anything happens is a hardware interrupt that does
      // nothing with the screen locked — which is how the button was found broken on 2026-09-10.
      client.onReadRequest(() => record('device.readRequest')),
      client.onDeviceWarmingUp(() => {
        // Not a failure and not on screen: the user pressed the button too early and the only thing
        // that helps is hearing that the wait is expected. `notify` puts it wherever they chose.
        record('device.warmingUp');
        void notify('busWarmingUp');
      }),
      client.onDeviceError((message) => {
        // The device has no screen: if something failed on it (bringing the AP up, the camera), the
        // app is the only place anyone can find out — and since telemetry exists, the table.
        record('device.warning', { detail: { message } });
        setLastNotice(message);
        // The board says the fixed sentence and the phone the whole thing, detail included: nobody
        // can pre-record a clip per error message, and the message is on screen and in the table above.
        void notify('deviceWarning', message);
      }),
    ];
    // The first connection comes out of the mount effect but on the next tick: the effect only
    // subscribes; connecting changes state and that does not belong inside the effect.
    const start = setTimeout(() => void connectRef.current(), 0);
    return () => {
      clearTimeout(start);
      for (const unsubscribe of unsubscribes) unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [applyStatus, startNetworkTransition, scheduleRetry]);

  const connect = useCallback(async () => {
    autoConnect.current = true;
    retry.current = 0;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await connectInternal();
  }, [connectInternal]);

  const disconnect = useCallback(async () => {
    // Disconnecting by hand turns reconnection off until the user searches again: otherwise the app
    // would reconnect on its own a second later and the button would be useless.
    autoConnect.current = false;
    record('ble.disconnected');
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // The device's network is NOT forgotten here: iOS drops a network that goes away on its own,
    // and forgetting it is what made the next connection ask "join ViroVision?" all over again.
    networkSyncRun.current += 1;
    syncedNetwork.current = { ap: false, ip: null, ok: false, running: false };
    announcedReadyFor.current = null;
    await getBleClient().disconnect();
    setConnection(initialConnection);
    setAddress(null);
    setAp(false);
    setWifi('off');
    setDeviceMode(null);
  }, []);

  const writeAudioTarget = useCallback(
    async (target: AudioOutput) => {
      if (connection.status !== 'connected') return;
      try {
        await getBleClient().writeAudioTarget(target);
      } catch (err) {
        // The device kept its previous target, so bus readings may come out of the wrong speaker.
        // Not worth interrupting the user for, and not worth hiding either: this is exactly the bug
        // that made a reading come out of the board with the setting on "phone" (2026-09-15).
        const detail = err instanceof Error ? err.message : String(err);
        record('device.audioTargetFailed', { detail: { target, message: detail } });
      }
    },
    [connection.status]
  );

  const writeMode = useCallback(
    async (mode: DeviceMode) => {
      if (connection.status !== 'connected') return;
      try {
        await getBleClient().writeMode(GATT_MODE[mode]);
        // Since 2026-09-07 the device's AP is always on: changing mode does NOT change the network,
        // and restarting the check here hid the device button for ~10 s for nothing. The transition
        // only starts if the device announces that its AP changed (the `ap` event).
      } catch (err) {
        // The device did not learn about the mode: the app carries on, but it says so. On 2026-09-06
        // the mode was not reaching the device and nobody knew until reading its log.
        const detail = err instanceof Error ? err.message : String(err);
        record('device.modeFailed', { detail: { mode, message: detail } });
        setLastNotice(`${strings.connect.modeWriteFailed} ${detail}`);
        void notify('modeWriteFailed', detail);
      }
    },
    [connection.status]
  );

  const photoAvailable = connection.status === 'connected' && wifi === 'ready' && address !== null;

  const downloadPhoto = useCallback(
    async (options?: { timeoutMs?: number }) => {
      if (!address) throw new Error(strings.connect.noAddress);
      // The caller sets the deadline. With the screen locked the whole cycle has seconds, not the
      // 20 s the download would take by default (`readingService.ts`).
      return downloadDevicePhoto(address, options);
    },
    [address]
  );

  const sendAudio = useCallback(
    async (uri: string): Promise<boolean> => {
      if (!photoAvailable || !address) return false;
      try {
        const { File } = await import('expo-file-system');
        const bytes = new Uint8Array(await new File(uri).arrayBuffer());
        // The body travels as base64 because React Native's `fetch` does not send raw bytes; the
        // device decodes it from the header.
        const r = await fetch(deviceUrl(address, '/audio'), {
          method: 'POST',
          headers: { 'Content-Type': 'audio/mpeg', 'X-Encoding': 'base64' },
          body: encodeBase64(bytes),
        });
        return r.ok;
      } catch {
        return false;
      }
    },
    [address, photoAvailable]
  );

  const value = useMemo<DeviceValue>(
    () => ({ connection, address, wifi, wifiDetail, lastNotice, photoAvailable, ap, deviceMode, connect, disconnect, writeMode, writeAudioTarget, downloadPhoto, sendAudio }),
    [connection, address, wifi, wifiDetail, lastNotice, photoAvailable, ap, deviceMode, connect, disconnect, writeMode, writeAudioTarget, downloadPhoto, sendAudio]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceValue {
  const value = useContext(DeviceContext);
  if (!value) throw new Error('useDevice requires DeviceProvider');
  return value;
}
