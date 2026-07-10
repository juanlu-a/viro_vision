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
}

export interface ConnectionState {
  status: ConnectionStatus;
  device: DeviceInfo | null;
  /** Human-readable message for the current status (Spanish, screen-reader friendly). */
  message: string;
}
