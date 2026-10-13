/**
 * The device's address on the local network and the typed error of talking to it over HTTP: the
 * photo path ADR 0003 decided on (WiFi, 46 ms against 4.5 s over BLE, measured 2026-09-05).
 *
 * BOUNDARY RULE (ADR 0003): this talks to the device on the local network, never to the internet.
 * The phone has to keep its own internet (cellular or WiFi) meanwhile; if the device is on the same
 * network as the phone there is no conflict, and if the device is the access point the system has to
 * route internet over cellular (spike pending). No TLS on purpose: WPA2 already encrypts the air and
 * the data is not sensitive; that is why `app.json` allows plain HTTP only towards the local network.
 *
 * `measureHttpDownload` used to live here too, downloading `/measure/<bytes>` and timing it. It left
 * with the measurement buttons: ADR 0003 is decided and the device is never going to serve filler
 * again.
 */

export class HttpDownloadError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = 'HttpDownloadError';
  }
}

export interface DeviceAddress {
  ip: string;
  port: number;
}

export function deviceUrl({ ip, port }: DeviceAddress, path: string): string {
  return `http://${ip}:${port}${path}`;
}
