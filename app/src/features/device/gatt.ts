/**
 * GATT profile of the ViroVision device (BLE data and control channel).
 *
 * SHARED SOURCE OF TRUTH with the device: `hardware/raspi/virovision/gatt.py` has these very same
 * UUIDs copied by hand. If something changes here, it changes there in the same PR.
 *
 * They are randomly generated 128-bit UUIDs (`uuidgen`), with the 3rd and 4th byte as the
 * characteristic index. The previous placeholders (0000fffX-0000-1000-8000-00805f9b34fb) were in the
 * range of 16-bit UUIDs assigned by the Bluetooth SIG: nothing can be invented there.
 *
 * What travels where (ADR 0003): BLE is the control plane, always alive, because it is the only
 * thing that can wake the app with the phone locked in a pocket. Whether the photo travels here too
 * or over WiFi was settled by the measurement the `measure` command triggers (see `services/ble`).
 */
export const GATT = {
  serviceUuid: '4380c500-7ca3-4e37-b27d-f60e8d8d73d1',
  characteristics: {
    /** read · notify · write — uint8: 0 idle, 1 bus, 2 supermarket (ADR 0007). */
    mode: '4380c501-7ca3-4e37-b27d-f60e8d8d73d1',
    /** write — JSON `{ cmd: 'measure' | 'photo' | 'mode' | 'status' | 'audio' | 'say', ... }`. */
    control: '4380c502-7ca3-4e37-b27d-f60e8d8d73d1',
    /** notify — JSON ≤ 180 bytes: `{ t: 'start' | 'end' | 'mode' | 'read' | 'ap' | 'error' | 'result', ... }`. */
    event: '4380c503-7ca3-4e37-b27d-f60e8d8d73d1',
    /**
     * notify — binary: a 4-byte header (`seq` u16 LE, `total` u16 LE) + data.
     *
     * **The app no longer uses it**: ADR 0003 closed in favour of HTTP over WiFi (46 ms against
     * 4.5 s), and the only client left with the measurement. It stays in the mirror because the
     * device still publishes it; removing it from `hardware/raspi/virovision/` is a separate PR, and
     * this comment exists so nobody wires it up again believing it is the photo path.
     */
    transfer: '4380c504-7ca3-4e37-b27d-f60e8d8d73d1',
    /** read · notify — JSON: `version`, `temp`, `uptime`, `battery` (null today), `camera`, `wifi`, `ip`, `port`, `ap`. */
    status: '4380c505-7ca3-4e37-b27d-f60e8d8d73d1',
    /** read — JSON `{ ssid, password, ip, port }` of the device's access point; `{}` when it has none. */
    wifi: '4380c506-7ca3-4e37-b27d-f60e8d8d73d1',
  },
} as const;

/** Local name the device advertises; scanning filters by the service UUID, this is for display. */
export const DEVICE_ADVERTISED_NAME = 'ViroVision';

/** What the device publishes on `status`. A mirror of `hardware/raspi/virovision/state.py`. */
export interface DeviceStatus {
  version: string;
  temp: number | null;
  uptime: number;
  battery: number | null;
  camera: boolean;
  wifi: boolean;
  /** The device's IP on the WiFi network, or null with no network. The app downloads the photo from here (ADR 0003, plan B). */
  ip: string | null;
  /** Port of the device's HTTP server, or null when it is not running. */
  port: number | null;
  /** True while the device is an access point: then `ip` is the AP's (10.42.0.1). */
  ap: boolean;
}

/**
 * Credentials of the device's access point (ADR 0003, plan B). The app reads them over BLE and joins
 * on its own: the user configures no WiFi. Without a secret on purpose: WPA2 encrypts the air and
 * the data is not sensitive.
 */
export interface WifiCredentials {
  ssid: string;
  password: string;
  ip: string;
  port: number | null;
}

/** Operating mode as the device encodes it in the `mode` characteristic (ADR 0007). */
export const GATT_MODE = { idle: 0, bus: 1, supermarket: 2 } as const;
export const MODE_FROM_GATT = ['idle', 'bus', 'supermarket'] as const;

/**
 * The command that tells the device where a bus reading should be heard.
 *
 * It lives here, with the rest of the protocol, and not in the BLE client: it is a contract with
 * `hardware/raspi/virovision/core.py`, which reads exactly these two keys and answers with an error
 * event for any other target. A typo on this side is silent - the device keeps its previous setting
 * and the reading comes out of the wrong speaker, which is how the bug was found on 2026-09-15.
 */
export function audioCommand(target: 'phone' | 'device'): string {
  return JSON.stringify({ cmd: 'audio', target });
}

/**
 * The command that makes the device say one of its pre-recorded system notices.
 *
 * `clip` is a file name under the board's `announcements/system/`, never a path: the board rejects
 * anything with a separator in it. The catalogue of names is `features/audio/notices.ts` on this
 * side and `hardware/raspi/virovision/notices.py` on the other, and they are asserted against each
 * other rather than trusted, because a name that does not exist fails the way this whole feature
 * fails — in silence.
 *
 * Why the board and not a sentence synthesized in the cloud: these are the notices that fire when
 * the network is broken, and the one saying so cannot need the network (ADR 0001).
 */
export function noticeCommand(clip: string): string {
  return JSON.stringify({ cmd: 'say', clip });
}
