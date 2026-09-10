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
 * - **Joins the device's WiFi** when it turns its access point on (which it does when a mode is
 *   activated), with the credentials that arrive over BLE, and leaves when it turns it off. Zero
 *   configuration.
 * - **Keeps the mode in sync**: the app writes it to the device and mirrors whatever the device
 *   reports.
 *
 * BOUNDARY RULE (ADR 0001): none of this is on the bus recognition path, which runs locally. What
 * does go out to the network is **telemetry**: it is recorded here and not in `features/audio` or
 * `features/recognition`, where the linter forbids it, and always without awaiting it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
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
import { WifiUnavailableError, waitForDevice, leaveWifi, currentSsid, joinWifi } from '@/services/wifi/join';

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
  /**
   * Counter of readings the physical button has asked for (ADR 0007, 2026-10 update). It is a
   * counter and not a boolean because two identical requests in a row have to be distinguishable:
   * in front of the shelf the user double-clicks once per product, and a flag would collapse the
   * second one into the first. Whoever reads it reacts to the number CHANGING, never to its value.
   */
  readRequest: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  writeMode: (mode: DeviceMode) => Promise<void>;
  downloadPhoto: () => Promise<DevicePhoto>;
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
  const [readRequest, setReadRequest] = useState(0);

  const credentials = useRef<WifiCredentials | null>(null);
  const joinedTo = useRef<string | null>(null);
  const autoConnect = useRef(true);
  const retry = useRef(0);
  const connecting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The connect function is referenced from the retry timer, which is defined before it: that is why
  // it goes in a ref instead of being captured directly.
  const connectRef = useRef<() => Promise<void>>(async () => {});
  const networkSyncRun = useRef(0);
  // The last thing synced, so the check does not restart with every `status` heartbeat.
  const syncedNetwork = useRef<{ ap: boolean; ip: string | null; ok: boolean }>({ ap: false, ip: null, ok: false });
  // The last `status` recorded, so the table does not fill with identical heartbeats.
  const statusFingerprint = useRef<string | null>(null);

  /**
   * The network follows the AP: join when the device turns it on, leave when it turns it off, and
   * check that the device answers before declaring the photo available. It is called from the event
   * handlers (connection, new status), never from an effect. Every run carries a number: if the
   * situation changed while it waited, its results are discarded.
   */
  const failNetwork = useCallback((detail: string) => {
    setWifi('error');
    setWifiDetail(detail);
    record('wifi.failed', { detail: { reason: detail } });
    // Voice is the interface: a silent failure leaves the user waiting for a button that never comes.
    announce(`${strings.connect.wifiFailedAnnounce} ${detail}`);
  }, []);

  const syncNetwork = useCallback(
    async (apOn: boolean, target: DeviceAddress | null): Promise<boolean> => {
      const run = ++networkSyncRun.current;
      const current = () => run === networkSyncRun.current;
      setWifiDetail(null);
      if (!target) {
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
      if (apOn && credentials.current && joinedTo.current !== credentials.current.ssid) {
        setWifi('joining');
        // If the phone is already on the device's network (iOS stores it as known and joins on its
        // own after the first time), the system is asked for nothing: asking can show the "allow
        // connection" prompt, and the user wants zero prompts after the first pairing.
        if ((await currentSsid()) === credentials.current.ssid) {
          joinedTo.current = credentials.current.ssid;
        }
        if (!current()) return false;
      }
      if (apOn && credentials.current && joinedTo.current !== credentials.current.ssid) {
        try {
          await joinWifi(credentials.current);
          joinedTo.current = credentials.current.ssid;
        } catch (err) {
          if (!current()) return false;
          failNetwork(
            err instanceof WifiUnavailableError
              ? strings.connect.wifiModuleMissing
              : `${strings.connect.wifiJoinFailed} ${err instanceof Error ? err.message : String(err)}`
          );
          return false;
        }
      }
      if (!apOn && joinedTo.current) {
        await leaveWifi(joinedTo.current);
        joinedTo.current = null;
      }
      if (!current()) return false;
      setWifi('joining');
      record('wifi.joining', { detail: { ap: apOn, ip: target.ip, ssid: credentials.current?.ssid ?? null } });
      const t0 = Date.now();
      const answers = await waitForDevice(target);
      if (!current()) return false;
      if (answers) {
        setWifi('ready');
        // The time until the device answers is what separates "it is slow" from "it does not work":
        // on 2026-09-06 the network never became ready and without this number there was no way to
        // know where it hung.
        record('wifi.ready', { ms: Date.now() - t0, detail: { ip: target.ip } });
        announce(strings.connect.wifiReadyAnnounce);
        return true;
      }
      failNetwork(strings.connect.wifiNoResponse.replace('{ip}', target.ip));
      return false;
    },
    [failNetwork]
  );

  /**
   * The device announces over BLE that its AP is changing BEFORE it switches networks: from that
   * instant the old address is useless and the device button has to disappear until `status` brings
   * the new one and `/health` answers. Without this, a tap during those seconds died waiting 20 s
   * (2026-09-05, first run of the flow).
   */
  const startNetworkTransition = useCallback(() => {
    networkSyncRun.current += 1;
    syncedNetwork.current = { ap: false, ip: null, ok: false };
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
      // previous one before it finished (joining the WiFi + waiting for the device can take more than
      // 15 s) and the network never became "ready" (2026-09-06). It only syncs when something changed,
      // or when it was left in a failed state.
      const previous = syncedNetwork.current;
      const changed = previous.ap !== status.ap || previous.ip !== (target?.ip ?? null);
      if (changed || !previous.ok) {
        syncedNetwork.current = { ap: status.ap, ip: target?.ip ?? null, ok: false };
        void syncNetwork(status.ap, target).then((ok) => {
          if (ok && syncedNetwork.current.ip === (target?.ip ?? null)) syncedNetwork.current.ok = true;
        });
      }
    },
    [syncNetwork]
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
      setAddress(device.address);
      setAp(device.ap);
      credentials.current = await client.readWifi().catch(() => null);
      syncedNetwork.current = { ap: device.ap, ip: device.address?.ip ?? null, ok: false };
      void syncNetwork(device.ap, device.address);
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
  }, [scheduleRetry, syncNetwork]);

  useEffect(() => {
    connectRef.current = connectInternal;
  }, [connectInternal]);

  // Client subscriptions, once.
  useEffect(() => {
    const client = getBleClient();
    const unsubscribes = [
      client.onDisconnect(() => {
        record('ble.lost');
        networkSyncRun.current += 1; // invalidates any network wait in flight
        setConnection({ status: 'error', device: null, message: strings.connection.lost });
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
      client.onReadRequest(() => {
        // Recorded here and not where it is served: this is the moment the user's finger asked for
        // it, and the gap against the `reading.start` that follows is what says whether the device
        // or the app is the slow half.
        record('device.readRequest');
        setReadRequest((n) => n + 1);
      }),
      client.onDeviceError((message) => {
        // The device has no screen: if something failed on it (bringing the AP up, the camera), the
        // app is the only place anyone can find out — and since telemetry exists, the table.
        record('device.warning', { detail: { message } });
        setLastNotice(message);
        announce(`${strings.connect.deviceErrorAnnounce} ${message}`);
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
    if (joinedTo.current) {
      await leaveWifi(joinedTo.current);
      joinedTo.current = null;
    }
    networkSyncRun.current += 1;
    await getBleClient().disconnect();
    setConnection(initialConnection);
    setAddress(null);
    setAp(false);
    setWifi('off');
    setDeviceMode(null);
  }, []);

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
        announce(`${strings.connect.modeWriteFailed} ${detail}`);
      }
    },
    [connection.status]
  );

  const photoAvailable = connection.status === 'connected' && wifi === 'ready' && address !== null;

  const downloadPhoto = useCallback(async () => {
    if (!address) throw new Error(strings.connect.noAddress);
    return downloadDevicePhoto(address);
  }, [address]);

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
    () => ({ connection, address, wifi, wifiDetail, lastNotice, photoAvailable, ap, deviceMode, readRequest, connect, disconnect, writeMode, downloadPhoto, sendAudio }),
    [connection, address, wifi, wifiDetail, lastNotice, photoAvailable, ap, deviceMode, readRequest, connect, disconnect, writeMode, downloadPhoto, sendAudio]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceValue {
  const value = useContext(DeviceContext);
  if (!value) throw new Error('useDevice requires DeviceProvider');
  return value;
}
