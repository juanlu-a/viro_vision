/**
 * The real BLE client over `react-native-ble-plx` (GATT central).
 *
 * It only runs in a development build or on TestFlight: the native module is in neither Expo Go nor
 * web. That is why `createBleClientPlx()` returns `null` instead of throwing when it cannot build
 * the `BleManager`, and `bleClient.ts` falls back to the stub.
 *
 * The only radio-free testable logic left is the characteristics' base64, in `base64.ts`; this file
 * only moves bytes between ble-plx and that module.
 */
import { Platform } from 'react-native';
import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

import { DEVICE_ADVERTISED_NAME, GATT, type DeviceStatus, type WifiCredentials } from '@/features/device/gatt';
import type { DeviceInfo } from '@/features/device/types';
import type { RecognitionEvent } from '@/features/recognition/types';
import { loadLastDeviceId, saveLastDeviceId } from '@/services/storage/lastDevice';
import { record } from '@/services/telemetry';

import {
  encodeBase64,
  decodeBase64,
  decodeTextBase64,
} from './base64';
import { BleDeviceNotFoundError, BleNotConnectedError, type BleClient } from './bleClient';

const SCAN_TIMEOUT_MS = 15_000;
/**
 * How long any single connect attempt may take before it is abandoned.
 *
 * It exists because CoreBluetooth's own `connect` has NO timeout: it waits for the peripheral to
 * show up for as long as the app lives. Without this number, connecting to a remembered identifier
 * whose board is switched off would hang the whole path forever, and the user would get a screen
 * that says "searching" and never changes again. Five seconds is ~10x a connect that works, so it
 * only ever fires on one that was not going to.
 */
const CONNECT_TIMEOUT_MS = 5_000;
/**
 * Android negotiates whatever MTU is asked for up to 517; iOS ignores the request and gives 185. A
 * large MTU does not move the photo —that goes over HTTP (ADR 0003)— but it does prevent the
 * `status` JSON or the WiFi credentials from arriving truncated, so the maximum is asked for anyway.
 */
const REQUESTED_MTU = 517;

/** What the device notifies over `event`. A mirror of `hardware/raspi/virovision/gatt.py`. */
type DeviceEvent =
  | { t: 'mode'; value: number }
  /** The button asked for a reading now (ADR 0007, 2026-10 update). Carries the mode it was in. */
  | { t: 'read'; mode: number }
  | { t: 'ap'; on: boolean; minutes: number }
  | { t: 'error'; msg: string }
  | { t: 'result'; event: RecognitionEvent };

function withDeadline<T>(ms: number, error: () => Error, run: (resolve: (v: T) => void, reject: (e: Error) => void) => void | (() => void)): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let cleanup: void | (() => void);
    const timer = setTimeout(() => {
      cleanup?.();
      reject(error());
    }, ms);
    cleanup = run(
      (v) => {
        clearTimeout(timer);
        cleanup?.();
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        cleanup?.();
        reject(e);
      }
    );
  });
}

export function createBleClientPlx(): BleClient | null {
  if (Platform.OS === 'web') return null;
  let manager: BleManager;
  try {
    manager = new BleManager();
  } catch {
    return null;
  }
  return new BleClientPlx(manager);
}

class BleClientPlx implements BleClient {
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private readonly recognitionListeners = new Set<(event: RecognitionEvent) => void>();
  private readonly disconnectListeners = new Set<() => void>();
  private readonly statusListeners = new Set<(status: DeviceStatus) => void>();
  private readonly modeListeners = new Set<(mode: number) => void>();
  private readonly apListeners = new Set<(on: boolean) => void>();
  private readonly readRequestListeners = new Set<(mode: number | null) => void>();
  private readonly errorListeners = new Set<(message: string) => void>();

  constructor(private readonly manager: BleManager) {}

  async connect(): Promise<DeviceInfo> {
    await this.waitForRadio();
    const shortcut = await this.shortcut();
    let device: Device | null = null;
    if (shortcut) {
      record('ble.found', { detail: { via: shortcut.via } });
      // A shortcut that does not work out costs one timeout and then gets out of the way. Without
      // this fallback a remembered identifier that stopped being valid —the board was replaced, the
      // phone was restored from a backup— would make the app stop scanning FOREVER, which is a much
      // worse failure than the slow reconnection it was meant to fix.
      device = await this.open(shortcut.id).catch(() => null);
      if (!device) record('ble.found', { detail: { via: shortcut.via, failed: true } });
    }
    if (!device) {
      const found = await this.scan();
      record('ble.found', { detail: { via: 'scan' } });
      device = await this.open(found.id);
    }
    this.device = device;
    // Remembered so the next connection can skip the scan (see `services/storage/lastDevice`).
    void saveLastDeviceId(device.id);

    this.subscriptions.push(
      this.manager.onDeviceDisconnected(device.id, () => {
        this.cleanup();
        // Released on our side too, even though the link is already gone. iOS otherwise keeps the
        // peripheral in a half-open state that the next `connectToDevice` queues behind, which turns
        // one dropped link into the several failed attempts the user has to sit through.
        void this.manager.cancelDeviceConnection(device.id).catch(() => {});
        for (const listener of this.disconnectListeners) listener();
      }),
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.event, (error, c) => {
        if (error || !c?.value) return;
        this.receiveEvent(c.value);
      }),
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.status, (error, c) => {
        if (error || !c?.value) return;
        try {
          const status = JSON.parse(decodeTextBase64(c.value)) as DeviceStatus;
          for (const listener of this.statusListeners) listener(status);
        } catch {
          /* an unreadable status takes nothing down */
        }
      }),
      this.manager.monitorCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.mode, (error, c) => {
        if (error || !c?.value) return;
        const bytes = decodeBase64(c.value);
        if (bytes.length > 0) for (const listener of this.modeListeners) listener(bytes[0]);
      })
    );

    const status = await this.readStatus(device);
    return {
      id: device.id,
      name: device.name ?? device.localName ?? DEVICE_ADVERTISED_NAME,
      batteryLevel: status?.battery ?? null,
      firmwareVersion: status?.version ?? null,
      address: status?.ip && status.port ? { ip: status.ip, port: status.port } : null,
      ap: status?.ap ?? false,
    };
  }

  async disconnect(): Promise<void> {
    const id = this.device?.id;
    this.cleanup();
    if (id) await this.manager.cancelDeviceConnection(id).catch(() => {});
  }

  onRecognition(listener: (event: RecognitionEvent) => void): () => void {
    this.recognitionListeners.add(listener);
    return () => this.recognitionListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  onStatus(listener: (status: DeviceStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMode(listener: (mode: number) => void): () => void {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  onAp(listener: (on: boolean) => void): () => void {
    this.apListeners.add(listener);
    return () => this.apListeners.delete(listener);
  }

  onDeviceError(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onReadRequest(listener: (mode: number | null) => void): () => void {
    this.readRequestListeners.add(listener);
    return () => this.readRequestListeners.delete(listener);
  }

  async writeMode(mode: number): Promise<void> {
    const device = this.device;
    if (!device) throw new BleNotConnectedError();
    await this.manager.writeCharacteristicWithResponseForDevice(
      device.id,
      GATT.serviceUuid,
      GATT.characteristics.mode,
      encodeBase64(new Uint8Array([mode]))
    );
  }

  async readWifi(): Promise<WifiCredentials | null> {
    const device = this.device;
    if (!device) throw new BleNotConnectedError();
    try {
      const c = await this.manager.readCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.wifi);
      if (!c.value) return null;
      const data = JSON.parse(decodeTextBase64(c.value)) as Partial<WifiCredentials>;
      return data.ssid && data.password && data.ip ? { ssid: data.ssid, password: data.password, ip: data.ip, port: data.port ?? null } : null;
    } catch {
      // Old firmware without the characteristic: the device offers no AP and the "same network" mode
      // still works.
      return null;
    }
  }

  // --- private ----------------------------------------------------------------------------------

  private async waitForRadio(): Promise<void> {
    if ((await this.manager.state()) === State.PoweredOn) return;
    await withDeadline<void>(
      SCAN_TIMEOUT_MS,
      () => new BleDeviceNotFoundError(),
      (resolve) => {
        const sub = this.manager.onStateChange((s) => {
          if (s === State.PoweredOn) resolve();
        }, true);
        return () => sub.remove();
      }
    );
  }

  /**
   * A peripheral we can try WITHOUT scanning, or null when there is none.
   *
   * This is the fix for "reconnecting takes several attempts" (2026-09-13), and it is an ordering
   * one: a scan only ever sees a peripheral that is advertising, and there are two ordinary
   * situations where ours is not.
   *
   * 1. **It is already connected to the system.** iOS keeps a peripheral connected across an app
   *    restart, and another app —or Settings— can hold it too. A connected peripheral advertises
   *    nothing and `startDeviceScan` will never report it, so the app scanned for 15 s, failed, and
   *    retried into the same wall. `connectedDevices` is the only API that sees these.
   * 2. **The board thinks the previous link is still up.** When the phone goes away without closing
   *    the connection, BlueZ keeps it open until the supervision timeout and does not advertise
   *    meanwhile. Connecting straight to a known identifier works here; scanning does not.
   *
   * Neither call touches the radio: both answer from the OS's own tables, so asking costs
   * milliseconds even when the board is switched off.
   */
  private async shortcut(): Promise<{ id: string; via: 'connected' | 'remembered' } | null> {
    const alreadyConnected = await this.manager.connectedDevices([GATT.serviceUuid]).catch(() => [] as Device[]);
    if (alreadyConnected.length > 0) return { id: alreadyConnected[0].id, via: 'connected' };

    const remembered = await loadLastDeviceId();
    if (!remembered) return null;
    const known = await this.manager.devices([remembered]).catch(() => [] as Device[]);
    return known.length > 0 ? { id: known[0].id, via: 'remembered' } : null;
  }

  /** Connects and discovers, leaving nothing pending on the OS if it fails. */
  private async open(id: string): Promise<Device> {
    try {
      // iOS ignores `requestMTU`; Android negotiates it right here and saves a second round trip.
      const connected = await this.manager.connectToDevice(id, {
        requestMTU: REQUESTED_MTU,
        timeout: CONNECT_TIMEOUT_MS,
      });
      return await connected.discoverAllServicesAndCharacteristics();
    } catch (err) {
      // A connect that failed leaves a pending request on the OS side, and on iOS a pending request
      // for a peripheral keeps the next one from being made: that is how one bad attempt turned into
      // "it takes several tries". Cancelling is what makes the retry a fresh attempt instead of
      // queueing behind the broken one.
      await this.manager.cancelDeviceConnection(id).catch(() => {});
      throw err;
    }
  }

  private scan(): Promise<Device> {
    // Filtering by service UUID and not by name: it is the only thing iOS also honours with the app
    // in the background, and the name may not be in the advertisement packet.
    return withDeadline<Device>(
      SCAN_TIMEOUT_MS,
      () => new BleDeviceNotFoundError(),
      (resolve) => {
        this.manager.startDeviceScan([GATT.serviceUuid], { allowDuplicates: false }, (error, device) => {
          if (error) {
            // One scan error is not the end of the scan. iOS reports transient ones (the radio
            // resetting, another app starting its own scan) and giving up on the first meant the
            // whole 15 s budget was thrown away on a hiccup — and the user got "device not found"
            // for a board that was sitting there advertising.
            record('ble.scanError', { detail: { message: error.message } });
            return;
          }
          if (device) resolve(device);
        });
        return () => {
          this.manager.stopDeviceScan().catch(() => {});
        };
      }
    );
  }

  private async readStatus(device: Device): Promise<DeviceStatus | null> {
    try {
      const c = await this.manager.readCharacteristicForDevice(device.id, GATT.serviceUuid, GATT.characteristics.status);
      return c.value ? (JSON.parse(decodeTextBase64(c.value)) as DeviceStatus) : null;
    } catch {
      // Without a status there is still a connection: the screen shows "not reported", not an error.
      return null;
    }
  }

  private receiveEvent(base64: string): void {
    let event: DeviceEvent;
    try {
      event = JSON.parse(decodeTextBase64(base64)) as DeviceEvent;
    } catch {
      // A frame that does not parse used to vanish without a trace, which reads exactly like a frame
      // that never arrived — and those two have completely different causes.
      record('ble.event', { detail: { parsed: false } });
      return;
    }
    // The first thing that can be observed after the radio. With the screen locked this is what
    // separates "iOS never woke us" from "we woke up and the rest of the chain failed", and there is
    // no console to ask: telemetry is the only witness (`services/` may import it; the ADR 0001 ban
    // covers `features/audio/` and `features/recognition/`).
    record('ble.event', { detail: { t: event.t } });
    switch (event.t) {
      case 'error':
        for (const listener of this.errorListeners) listener(event.msg);
        break;
      case 'ap':
        for (const listener of this.apListeners) listener(event.on);
        break;
      case 'read': {
        // The board says which mode it is reading in, and that number is the whole point: see
        // `onReadRequest` in `bleClient.ts`. `undefined` is a board from before the field existed.
        const mode = typeof event.mode === 'number' ? event.mode : null;
        for (const listener of this.readRequestListeners) listener(mode);
        break;
      }
      case 'result':
        for (const listener of this.recognitionListeners) listener(event.event);
        break;
      default:
        break;
    }
  }

  private cleanup(): void {
    for (const s of this.subscriptions) s.remove();
    this.subscriptions = [];
    this.device = null;
  }
}
