/**
 * GATT profile for the ViroVision device (BLE data/control channel).
 *
 * BLE carries data and control only — recognition results and commands. Audio does NOT go over BLE
 * (insufficient bandwidth for real-time audio); it uses a separate channel (Bluetooth Classic
 * A2DP/HFP or wired), decided by the hardware pillar.
 *
 * NOTE: these UUIDs are placeholders. Replace them with the actual UUIDs exposed by the device's
 * GATT server (defined together with the hardware pillar) before wiring real communication.
 */
export const GATT = {
  /** Primary ViroVision service. */
  serviceUuid: '0000fff0-0000-1000-8000-00805f9b34fb',
  characteristics: {
    /** Device → app: notifies recognition results (JSON matching RecognitionEvent). */
    recognitionResults: '0000fff1-0000-1000-8000-00805f9b34fb',
    /** App → device: send commands (start/stop, mode: bus vs. product). */
    control: '0000fff2-0000-1000-8000-00805f9b34fb',
    /** Device → app: battery / status telemetry. */
    status: '0000fff3-0000-1000-8000-00805f9b34fb',
  },
} as const;

/** Local name advertised by the device, used to filter scan results. */
export const DEVICE_ADVERTISED_NAME = 'ViroVision';
