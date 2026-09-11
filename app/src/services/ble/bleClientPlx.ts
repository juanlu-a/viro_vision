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
import { record } from '@/services/telemetry';

import {
  encodeBase64,
  decodeBase64,
  decodeTextBase64,
} from './base64';
import { BleDeviceNotFoundError, BleNotConnectedError, type BleClient } from './bleClient';

const SCAN_TIMEOUT_MS = 15_000;
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
  private readonly readRequestListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(message: string) => void>();

  constructor(private readonly manager: BleManager) {}

  async connect(): Promise<DeviceInfo> {
    await this.waitForRadio();
    const found = await this.scan();
    // iOS ignores `requestMTU`; Android negotiates it right here and saves a second round trip.
    const connected = await this.manager.connectToDevice(found.id, { requestMTU: REQUESTED_MTU });
    const device = await connected.discoverAllServicesAndCharacteristics();
    this.device = device;

    this.subscriptions.push(
      this.manager.onDeviceDisconnected(device.id, () => {
        this.cleanup();
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

  onReadRequest(listener: () => void): () => void {
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

  private scan(): Promise<Device> {
    // Filtering by service UUID and not by name: it is the only thing iOS also honours with the app
    // in the background, and the name may not be in the advertisement packet.
    return withDeadline<Device>(
      SCAN_TIMEOUT_MS,
      () => new BleDeviceNotFoundError(),
      (resolve, reject) => {
        this.manager.startDeviceScan([GATT.serviceUuid], { allowDuplicates: false }, (error, device) => {
          if (error) {
            reject(new BleDeviceNotFoundError());
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
      case 'read':
        for (const listener of this.readRequestListeners) listener();
        break;
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
