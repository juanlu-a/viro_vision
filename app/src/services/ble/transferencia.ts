/**
 * Reensamblado y medición de una transferencia por notificaciones GATT.
 *
 * Módulo PURO (sin ble-plx, sin React) a propósito: el número que produce decide el ADR 0003 —
 * si 53 KB bajan por BLE en menos de 2 s no hace falta WiFi — y un header mal leído o un chunk
 * contado dos veces inflan o achican ese número sin ningún error visible. Por eso se testea acá y
 * el cliente BLE sólo le pasa bytes.
 *
 * Formato del chunk (espejo de `hardware/raspi/virovision/transferencia.py`): header de 4 bytes,
 * `seq` uint16 LE + `total` uint16 LE, y después los datos.
 */

export const HEADER_BYTES = 4;

export class BleTransferError extends Error {
  constructor(
    message: string,
    /** Chunks que nunca llegaron cuando venció el plazo; vacío si el error fue otro. */
    readonly faltantes: number[] = []
  ) {
    super(message);
    this.name = 'BleTransferError';
  }
}

export interface ChunkParseado {
  seq: number;
  total: number;
  datos: Uint8Array;
}

export function parsearChunk(bytes: Uint8Array): ChunkParseado {
  if (bytes.length < HEADER_BYTES) {
    throw new BleTransferError(`chunk de ${bytes.length} bytes: más corto que el header`);
  }
  const seq = bytes[0] | (bytes[1] << 8);
  const total = bytes[2] | (bytes[3] << 8);
  return { seq, total, datos: bytes.subarray(HEADER_BYTES) };
}

export interface MedicionTransferencia {
  /** Bytes de datos recibidos (sin headers). */
  bytes: number;
  chunks: number;
  /** Tamaño de la notificación más grande recibida, header incluido. */
  chunkBytes: number;
  /** Del primer chunk al último, en milisegundos. */
  ms: number;
  /** Kilobytes por segundo (1 KB = 1000 bytes), o sea bytes / ms. */
  kbps: number;
}

/**
 * Junta los chunks de UNA transferencia y mide del primero al último. El reloj se inyecta para que
 * el test no tarde lo que tarda una transferencia real.
 */
export class Ensamblador {
  private readonly partes = new Map<number, Uint8Array>();
  private total: number | null = null;
  private primero: number | null = null;
  private ultimo: number | null = null;
  private chunkMax = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Devuelve true cuando llegaron todos los chunks. Un chunk repetido no cuenta dos veces. */
  recibir(bytes: Uint8Array): boolean {
    const t = this.now();
    const { seq, total, datos } = parsearChunk(bytes);
    if (this.total === null) this.total = total;
    else if (total !== this.total) {
      throw new BleTransferError(`total inconsistente: ${total} y ${this.total}`);
    }
    if (this.primero === null) this.primero = t;
    this.ultimo = t;
    this.chunkMax = Math.max(this.chunkMax, bytes.length);
    this.partes.set(seq, datos);
    return this.completo;
  }

  get completo(): boolean {
    return this.total !== null && this.partes.size >= this.total;
  }

  faltantes(): number[] {
    const faltan: number[] = [];
    for (let seq = 0; seq < (this.total ?? 0); seq++) if (!this.partes.has(seq)) faltan.push(seq);
    return faltan;
  }

  payload(): Uint8Array {
    if (!this.completo) throw new BleTransferError('transferencia incompleta', this.faltantes());
    const total = this.total ?? 0;
    let largo = 0;
    for (let seq = 0; seq < total; seq++) largo += this.partes.get(seq)!.length;
    const salida = new Uint8Array(largo);
    let offset = 0;
    for (let seq = 0; seq < total; seq++) {
      const parte = this.partes.get(seq)!;
      salida.set(parte, offset);
      offset += parte.length;
    }
    return salida;
  }

  medicion(): MedicionTransferencia {
    if (!this.completo || this.primero === null || this.ultimo === null) {
      throw new BleTransferError('transferencia incompleta', this.faltantes());
    }
    let bytes = 0;
    for (const parte of this.partes.values()) bytes += parte.length;
    // Con un solo chunk primero === último y ms = 0: se reporta 1 ms para no dividir por cero. Una
    // medición de un chunk no dice nada del enlace igual.
    const ms = Math.max(1, this.ultimo - this.primero);
    return { bytes, chunks: this.partes.size, chunkBytes: this.chunkMax, ms, kbps: bytes / ms };
  }
}

// --- base64 -----------------------------------------------------------------------------------
// ble-plx entrega y recibe los valores en base64. Se implementa acá y no con `atob`/`Buffer` porque
// ni uno ni otro están garantizados en todos los runtimes donde corre este módulo (Hermes, jest,
// web), y son quince líneas.

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
