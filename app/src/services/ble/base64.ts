/**
 * Base64 para el enlace BLE: ble-plx entrega y recibe todos los valores de característica en
 * base64, así que cada lectura y cada escritura pasa por acá.
 *
 * Se implementa a mano y no con `atob`/`Buffer` porque ni uno ni otro están garantizados en todos
 * los runtimes donde corre este módulo (Hermes, jest, web), y son quince líneas.
 *
 * Vivía en `transferencia.ts` junto al reensamblado de chunks; ese módulo se fue con la medición
 * del ADR 0003 (la foto va por HTTP, no por GATT) y esto quedó, que es lo único que se seguía
 * usando.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INVERSO = new Map<string, number>([...ALFABETO].map((c, i) => [c, i]));

export function decodificarBase64(texto: string): Uint8Array {
  const limpio = texto.replace(/[^A-Za-z0-9+/]/g, '');
  const salida = new Uint8Array(Math.floor((limpio.length * 3) / 4));
  let acumulado = 0;
  let bits = 0;
  let i = 0;
  for (const c of limpio) {
    acumulado = (acumulado << 6) | INVERSO.get(c)!;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      salida[i++] = (acumulado >> bits) & 0xff;
    }
  }
  return salida.subarray(0, i);
}

export function codificarBase64(bytes: Uint8Array): string {
  let salida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    salida += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
    salida += b1 === undefined ? '=' : ALFABETO[(n >> 6) & 63];
    salida += b2 === undefined ? '=' : ALFABETO[n & 63];
  }
  return salida;
}

export function codificarTextoBase64(texto: string): string {
  return codificarBase64(new TextEncoder().encode(texto));
}

export function decodificarTextoBase64(base64: string): string {
  return new TextDecoder().decode(decodificarBase64(base64));
}
