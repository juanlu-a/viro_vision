/**
 * BLE client of the ViroVision device (data and control channel).
 *
 * "Interface + stub + selector" pattern (see the conventions): `getBleClient()` returns the real
 * client over `react-native-ble-plx` when the native module exists (development build / TestFlight),
 * and a stub that fails with a typed error where it does not (Expo Go, web, jest). It degrades to a
 * labelled state, it never breaks and never pretends.
 *
 * The GATT profile lives in `features/device/gatt.ts`, a mirror of
 * `hardware/raspi/virovision/gatt.py`.
 */
import type { DeviceStatus, WifiCredentials } from '@/features/device/gatt';
import type { DeviceInfo } from '@/features/device/types';
import type { RecognitionEvent } from '@/features/recognition/types';

import { createBleClientPlx } from './bleClientPlx';

export interface BleClient {
  /** Looks for the device by service UUID and connects. Resolves with its data. */
  connect(): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  /** Recognition results sent by the device. Returns the unsubscribe function. */
  onRecognition(listener: (event: RecognitionEvent) => void): () => void;
  /**
   * Reports when the link drops outside `disconnect()` (the device rebooted, went out of range, iOS
   * cut it). Without this the screen kept saying "Connected" with the link dead on 2026-09-05, and
   * every command failed without explanation.
   */
  onDisconnect(listener: () => void): () => void;
  /** Every `status` notification (roughly every 15 s, and whenever the AP changes). */
  onStatus(listener: (status: DeviceStatus) => void): () => void;
  /** Mode changes reported by the device (physical button, or an echo of `writeMode`). 0/1/2 (ADR 0007). */
  onMode(listener: (mode: number) => void): () => void;
  /** The device turned its access point on or off: its network address is about to change. */
  onAp(listener: (on: boolean) => void): () => void;
  /** Error notices sent by the device (`{t:'error', msg}`), to show and to speak. */
  onDeviceError(listener: (message: string) => void): () => void;
  /** Sets the mode on the device (0 idle, 1 bus, 2 supermarket). It turns its AP on or off. */
  writeMode(mode: number): Promise<void>;
  /** Credentials of the device's AP, or null when it has none. */
  readWifi(): Promise<WifiCredentials | null>;
}

/** The build lacks the native BLE module (Expo Go, web). */
export class BleNotImplementedError extends Error {
  constructor() {
    super('BLE_NOT_IMPLEMENTED');
    this.name = 'BleNotImplementedError';
  }
}

/** The scan expired without seeing the device. */
export class BleDeviceNotFoundError extends Error {
  constructor() {
    super('BLE_DEVICE_NOT_FOUND');
    this.name = 'BleDeviceNotFoundError';
  }
}

/** Something requiring a connection was asked for and there is none. */
export class BleNotConnectedError extends Error {
  constructor() {
    super('BLE_NOT_CONNECTED');
    this.name = 'BleNotConnectedError';
  }
}

/**
 * A simulated device, so the connected-device screen can be seen and demoed without hardware. It
 * sits behind an environment variable of its own and not behind `__DEV__` on purpose: that way it
 * can be switched on in a release build for a demo, and it is impossible for it to slip into a
 * normal build. The UI labels it as simulated; this does NOT pretend BLE works.
 */
const SIMULATE_DEVICE = process.env.EXPO_PUBLIC_SIMULATE_DEVICE === '1';

const simulatedDevice: DeviceInfo = {
  id: 'simulated-0001',
  name: 'ViroVision (simulado)',
  batteryLevel: 76,
  firmwareVersion: '0.1.0-dev',
  address: null,
  ap: false,
};

const stubClient: BleClient = {
  async connect() {
    if (SIMULATE_DEVICE) return simulatedDevice;
    throw new BleNotImplementedError();
  },
  async disconnect() {
    /* nothing connected */
  },
  onRecognition() {
    return () => {};
  },
  onDisconnect() {
    return () => {};
  },
  onStatus() {
    return () => {};
  },
  onMode() {
    return () => {};
  },
  onAp() {
    return () => {};
  },
  onDeviceError() {
    return () => {};
  },
  async writeMode() {
    if (!SIMULATE_DEVICE) throw new BleNotImplementedError();
  },
  async readWifi() {
    return null;
  },
};

let client: BleClient | null = null;

/**
 * The real client is built once and on demand: `BleManager` opens the native module on instantiation
 * and throws where it does not exist. That throw is the signal to fall back to the stub.
 */
export function getBleClient(): BleClient {
  if (client) return client;
  client = SIMULATE_DEVICE ? stubClient : (createBleClientPlx() ?? stubClient);
  return client;
}
