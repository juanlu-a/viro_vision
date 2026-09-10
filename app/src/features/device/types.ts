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
   * Battery level 0-100, or null when the device has not reported it yet. It arrives through the
   * GATT `status` characteristic (see features/device/gatt.ts).
   */
  batteryLevel: number | null;
  /** Firmware version reported by the device, or null. */
  firmwareVersion: string | null;
  /**
   * The device's HTTP address on the local network (ADR 0003, plan B), or null when the device is
   * not on a network or is not running the server. It arrives through the `status` characteristic.
   */
  address: { ip: string; port: number } | null;
  /** True when the device is acting as an access point right now (ADR 0003, plan B). */
  ap: boolean;
}

export interface ConnectionState {
  status: ConnectionStatus;
  device: DeviceInfo | null;
  /** Human-readable message for the current status (Spanish, screen-reader friendly). */
  message: string;
}
