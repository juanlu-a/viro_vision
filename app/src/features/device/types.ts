/** Connection lifecycle for the BLE link to the ViroVision device. */
export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export interface DeviceInfo {
  id: string;
  name: string | null;
  /**
   * Nivel de batería 0–100, o null si el dispositivo todavía no lo reportó. Llega por la
   * característica `status` del GATT (ver features/device/gatt.ts).
   */
  batteryLevel: number | null;
  /** Versión de firmware informada por el dispositivo, o null. */
  firmwareVersion: string | null;
  /**
   * Dirección HTTP de la placa en la red local (ADR 0003, plan B), o null si la placa no está en
   * una red o no corre el servidor. Llega por la característica `estado`.
   */
  direccion: { ip: string; puerto: number } | null;
}

export interface ConnectionState {
  status: ConnectionStatus;
  device: DeviceInfo | null;
  /** Human-readable message for the current status (Spanish, screen-reader friendly). */
  message: string;
}
