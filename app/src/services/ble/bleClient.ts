/**
 * BLE client for the ViroVision device (data/control channel).
 *
 * STATUS: interface + honest stub. The real implementation wraps `react-native-ble-plx`'s
 * `BleManager` (GATT central), which requires a custom dev client / EAS build — it is NOT available
 * in Expo Go or on web. To keep the app runnable everywhere during scaffolding, we do not construct
 * `BleManager` here yet; the stub reports "unavailable" instead of crashing.
 *
 * When implementing, wire against `GATT` (see features/device/gatt.ts):
 *   - scan filtering by DEVICE_ADVERTISED_NAME
 *   - connect + discoverAllServicesAndCharacteristics
 *   - monitor GATT.characteristics.recognitionResults → parse RecognitionEvent
 *   - write GATT.characteristics.control for commands
 */
import type { DeviceInfo } from '@/features/device/types';
import type { RecognitionEvent } from '@/features/recognition/types';

export interface BleClient {
  /** Scan for and connect to the ViroVision device. Resolves with the connected device. */
  connect(): Promise<DeviceInfo>;
  /** Disconnect from the current device. */
  disconnect(): Promise<void>;
  /** Subscribe to recognition events. Returns an unsubscribe function. */
  onRecognition(listener: (event: RecognitionEvent) => void): () => void;
}

/**
 * Dispositivo simulado para poder ver y demostrar la pantalla de dispositivo conectado sin
 * hardware — el pilar de hardware está bloqueado por compra de componentes (B2).
 *
 * Va detrás de una variable de entorno propia y no de `__DEV__` a propósito: así se puede activar
 * en un build de release para una demo, y es imposible que se cuele en un build normal. La UI lo
 * rotula como simulado; esto NO finge que el BLE funciona.
 */
const SIMULATE_DEVICE = process.env.EXPO_PUBLIC_SIMULATE_DEVICE === '1';

const simulatedDevice: DeviceInfo = {
  id: 'simulado-0001',
  name: 'ViroVision (simulado)',
  batteryLevel: 76,
  firmwareVersion: '0.1.0-dev',
};

/** Thrown by the stub until the real BLE layer is implemented. */
export class BleNotImplementedError extends Error {
  constructor() {
    super('BLE_NOT_IMPLEMENTED');
    this.name = 'BleNotImplementedError';
  }
}

const stubClient: BleClient = {
  async connect() {
    if (SIMULATE_DEVICE) return simulatedDevice;
    throw new BleNotImplementedError();
  },
  async disconnect() {
    /* no-op: nothing is connected in the stub */
  },
  onRecognition() {
    return () => {};
  },
};

/**
 * Returns the app's BLE client. Swap `stubClient` for the real `react-native-ble-plx`-backed
 * implementation once the dev client build and device GATT server exist.
 */
export function getBleClient(): BleClient {
  return stubClient;
}
