/**
 * The photo taken by the device's camera, downloaded over WiFi (ADR 0003, plan B). Since the phone's
 * camera left, it is the ONLY image source of the reader.
 *
 * `GET /photos/latest` captures on the device and returns the JPEG already at 1024 px and quality 70
 * — the ceiling the vision APIs rescale to anyway to build their tile mosaic, so rescaling on the
 * phone side bought no detail and no longer exists. It is cached with a `uri` for the local OCR
 * (which reads files) and the base64 is returned for the cloud, which is all supermarket mode needs.
 *
 * **The size is set by the device**: if it ever captures larger, that is paid in transport and in
 * tokens without gaining accuracy. The place to fix it is `hardware/raspi/virovision/camera.py`.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { encodeBase64 } from '@/services/ble/base64';
import { HttpDownloadError, deviceUrl } from '@/services/wifi/deviceHttp';

const FOLDER = 'device-photos';

/** The image as the cloud model expects it: base64 without the `data:` prefix. */
export interface CloudImage {
  imageBase64: string;
  mediaType: 'image/jpeg';
}

export interface DevicePhoto {
  uri: string;
  image: CloudImage;
  bytes: number;
  /** From the request to the last byte, capture included. */
  ms: number;
}

interface Deps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  save?: (bytes: Uint8Array) => string;
}

function saveToCache(bytes: Uint8Array): string {
  const folder = new Directory(Paths.cache, FOLDER);
  if (!folder.exists) folder.create({ idempotent: true });
  const file = new File(folder, `device-${Date.now()}.jpg`);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

export async function downloadDevicePhoto(
  address: { ip: string; port: number },
  { fetchImpl = fetch, now = Date.now, timeoutMs = 20_000, save = saveToCache }: Deps = {}
): Promise<DevicePhoto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = now();
  let response: Response;
  try {
    response = await fetchImpl(deviceUrl(address, '/photos/latest'), { signal: controller.signal, cache: 'no-store' });
  } catch (err) {
    clearTimeout(timer);
    throw new HttpDownloadError(controller.signal.aborted ? `the device did not answer in ${timeoutMs / 1000} s` : err instanceof Error ? err.message : String(err));
  }
  if (!response.ok) {
    clearTimeout(timer);
    // 503 = the device has no camera; it says so and the UI can tell it apart.
    throw new HttpDownloadError(response.status === 503 ? 'the device has no camera' : `the device answered ${response.status}`, response.status);
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
  const ms = Math.max(1, now() - t0);
  return {
    uri: save(bytes),
    image: { imageBase64: encodeBase64(bytes), mediaType: 'image/jpeg' },
    bytes: bytes.length,
    ms,
  };
}
