/**
 * Base64 for the BLE link: ble-plx hands over and receives every characteristic value in base64, so
 * every read and every write goes through here.
 *
 * It is implemented by hand and not with `atob`/`Buffer` because neither is guaranteed in all the
 * runtimes this module runs in (Hermes, jest, web), and it is fifteen lines.
 *
 * It used to live in `transferencia.ts` next to the chunk reassembly; that module left with the
 * ADR 0003 measurement (the photo goes over HTTP, not over GATT) and this stayed, which is the only
 * part still being used.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const REVERSE = new Map<string, number>([...ALPHABET].map((c, i) => [c, i]));

export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let i = 0;
  for (const c of clean) {
    acc = (acc << 6) | REVERSE.get(c)!;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[i++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, i);
}

export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += b1 === undefined ? '=' : ALPHABET[(n >> 6) & 63];
    out += b2 === undefined ? '=' : ALPHABET[n & 63];
  }
  return out;
}

export function encodeTextBase64(text: string): string {
  return encodeBase64(new TextEncoder().encode(text));
}

export function decodeTextBase64(base64: string): string {
  return new TextDecoder().decode(decodeBase64(base64));
}
