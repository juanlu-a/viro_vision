/**
 * Cliente BLE del dispositivo ViroVision (canal de datos y control).
 *
 * Patrón "interfaz + stub + selector" (ver convenciones): `getBleClient()` devuelve el cliente real
 * sobre `react-native-ble-plx` cuando el módulo nativo existe (development build / TestFlight), y
 * un stub que falla con un error tipado donde no existe (Expo Go, web, jest). Degrada a un estado
 * rotulado, nunca rompe ni finge.
 *
 * El perfil GATT vive en `features/device/gatt.ts`, espejo de `hardware/raspi/virovision/gatt.py`.
 */
import type { DeviceInfo } from '@/features/device/types';
import type { RecognitionEvent } from '@/features/recognition/types';

import { crearBleClientPlx } from './bleClientPlx';
import type { MedicionTransferencia } from './transferencia';

export interface BleClient {
  /** Busca el dispositivo por el UUID del servicio y se conecta. Resuelve con sus datos. */
  connect(): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  /** Resultados de reconocimiento que manda la placa. Devuelve la función para desuscribirse. */
  onRecognition(listener: (event: RecognitionEvent) => void): () => void;
  /**
   * Avisa cuando el enlace se cae por fuera de `disconnect()` (la placa se reinició, se alejó, iOS
   * cortó). Sin esto la pantalla siguió diciendo «Conectado» con el enlace muerto el 2026-09-05, y
   * cada comando fallaba sin explicación.
   */
  onDisconnect(listener: () => void): () => void;
  /**
   * Spike del ADR 0003: pide a la placa `bytes` de relleno por la característica `transferencia`
   * y mide cuánto tardan en llegar. Con 53 000 bytes (la foto que hoy sube a la nube) el umbral es
   * 2 s: menos, BLE alcanza y no hace falta WiFi.
   */
  medirTransferencia(bytes: number): Promise<MedicionTransferencia>;
}

/** El build no tiene el módulo nativo de BLE (Expo Go, web). */
export class BleNotImplementedError extends Error {
  constructor() {
    super('BLE_NOT_IMPLEMENTED');
    this.name = 'BleNotImplementedError';
  }
}

/** El escaneo venció sin ver el dispositivo. */
export class BleDeviceNotFoundError extends Error {
  constructor() {
    super('BLE_DEVICE_NOT_FOUND');
    this.name = 'BleDeviceNotFoundError';
  }
}

/** Se pidió algo que necesita conexión y no la hay. */
export class BleNotConnectedError extends Error {
  constructor() {
    super('BLE_NOT_CONNECTED');
    this.name = 'BleNotConnectedError';
  }
}

/**
 * Dispositivo simulado para poder ver y demostrar la pantalla de dispositivo conectado sin
 * hardware. Va detrás de una variable de entorno propia y no de `__DEV__` a propósito: así se puede
 * activar en un build de release para una demo, y es imposible que se cuele en un build normal. La
 * UI lo rotula como simulado; esto NO finge que el BLE funciona.
 */
const SIMULATE_DEVICE = process.env.EXPO_PUBLIC_SIMULATE_DEVICE === '1';

const simulatedDevice: DeviceInfo = {
  id: 'simulado-0001',
  name: 'ViroVision (simulado)',
  batteryLevel: 76,
  firmwareVersion: '0.1.0-dev',
  direccion: null,
};

const stubClient: BleClient = {
  async connect() {
    if (SIMULATE_DEVICE) return simulatedDevice;
    throw new BleNotImplementedError();
  },
  async disconnect() {
    /* nada conectado */
  },
  onRecognition() {
    return () => {};
  },
  onDisconnect() {
    return () => {};
  },
  async medirTransferencia() {
    throw new BleNotImplementedError();
  },
};

let cliente: BleClient | null = null;

/**
 * El cliente real se construye una sola vez y a demanda: `BleManager` abre el módulo nativo al
 * instanciarse y lanza donde no existe. Ese lanzamiento es la señal para caer al stub.
 */
export function getBleClient(): BleClient {
  if (cliente) return cliente;
  cliente = SIMULATE_DEVICE ? stubClient : (crearBleClientPlx() ?? stubClient);
  return cliente;
}
