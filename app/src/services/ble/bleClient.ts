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
  /**
   * The physical button asked for a reading NOW (`{t:'read'}`, ADR 0007 2026-10 update). It is a
   * separate signal from `onMode` because a double click in supermarket changes no mode and still
   * has to take a photo — keying the capture off the transition is exactly what made the second
   * double click do nothing.
   *
   * **It carries the mode the board was in, and the listener has to use it** (0/1/2, or null from a
   * board too old to send it). The two signals do not travel at the same speed on this side: `read`
   * is served synchronously in the BLE callback, while `onMode` goes through React state and a
   * commit. So on the double click that ALSO changes the mode, the reading always arrives first and
   * would otherwise run against the previous mode — or, from idle, be dropped outright. That is the
   * "it turns supermarket on but takes no photo, and only the next double click reads" reported on
   * 2026-09-13.
   */
  onReadRequest(listener: (mode: number | null) => void): () => void;
  /**
   * The device was asked for bus mode before its OCR had finished loading, and is saying so. It fires
   * on the board's own signal because the board is the only one that knows: the load takes tens of
   * seconds after power-on and, until 2026-09-22, a button press inside that window left the device
   * silent. The board plays the clip when the output is itself; this is the other half, for a phone
   * that is doing the listening.
   */
  onDeviceWarmingUp(listener: () => void): () => void;
  /** Sets the mode on the device (0 idle, 1 bus, 2 supermarket). It turns its AP on or off. */
  writeMode(mode: number): Promise<void>;

  /**
   * Tells the device where the user wants to hear a bus reading. The device speaks with its own
   * pre-recorded announcements and has no way to know the setting, so until it is told it uses its
   * default (itself) and talks over the phone's choice.
   */
  writeAudioTarget(target: 'phone' | 'device'): Promise<void>;
  /**
   * Plays one of the device's pre-recorded system notices on its speaker (`cmd: 'say'`).
   *
   * `clip` is a file name from `features/audio/notices.ts`. It is the notices' whole transport: BLE
   * and not the HTTP server, because a notice has to be sayable when the WiFi is exactly what
   * failed — and it is a clip and not a synthesized sentence because that would need internet
   * (ADR 0001).
   */
  playNotice(clip: string): Promise<void>;
  /**
   * Corta lo que esté sonando en el parlante de la placa.
   *
   * Se manda **antes de que hable el teléfono**. Cada salida sabía interrumpirse a sí misma y
   * ninguna a la otra, así que dos voces podían quedar encimadas — y para quien no ve la pantalla,
   * dos voces simultáneas no son información.
   */
  hushDevice(): Promise<void>;
  /**
   * Whether there is a live GATT link right now.
   *
   * Synchronous and cheap on purpose: the announcement path has to know **where to speak** before it
   * says anything, and it cannot await to find out. It answers from what this client already holds,
   * it does not touch the radio.
   */
  isLinked(): boolean;
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
  onReadRequest() {
    return () => {};
  },
  onDeviceWarmingUp() {
    return () => {};
  },
  async writeMode() {
    if (!SIMULATE_DEVICE) throw new BleNotImplementedError();
  },
  async writeAudioTarget() {
    if (!SIMULATE_DEVICE) throw new BleNotImplementedError();
  },
  async playNotice() {
    if (!SIMULATE_DEVICE) throw new BleNotImplementedError();
  },
  async hushDevice() {
    /* no hay placa que callar */
  },
  isLinked() {
    // False in a build with no BLE, and false in the simulated one too: the simulated device has no
    // speaker, so claiming a link would send every notice to a board that cannot play it and leave
    // the demo silent. The fallback to the phone is exactly the right answer here.
    return false;
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
