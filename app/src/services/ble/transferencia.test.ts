/**
 * Existe porque el número que sale de acá decide el ADR 0003: si 53 KB bajan por BLE en menos de
 * 2 s, no hace falta WiFi. Un header leído al revés (big endian), un chunk repetido contado dos
 * veces o un reloj mal tomado cambian la conclusión sin que nada falle a la vista.
 */
import {
  BleTransferError,
  Ensamblador,
  codificarBase64,
  codificarTextoBase64,
  decodificarBase64,
  decodificarTextoBase64,
  parsearChunk,
} from './transferencia';

function chunk(seq: number, total: number, datos: number[]): Uint8Array {
  return new Uint8Array([seq & 0xff, seq >> 8, total & 0xff, total >> 8, ...datos]);
}

function relojDe(...instantes: number[]): () => number {
  let i = 0;
  return () => instantes[Math.min(i++, instantes.length - 1)];
}

describe('parsearChunk', () => {
  it('lee seq y total en little endian, como los escribe la placa', () => {
    const { seq, total, datos } = parsearChunk(new Uint8Array([0x2a, 0x01, 0x2b, 0x01, 9, 8]));
    expect(seq).toBe(298);
    expect(total).toBe(299);
    expect(Array.from(datos)).toEqual([9, 8]);
  });

  it('rechaza un chunk más corto que el header', () => {
    expect(() => parsearChunk(new Uint8Array([1, 2, 3]))).toThrow(BleTransferError);
  });
});

describe('Ensamblador', () => {
  it('reensambla en orden y mide del primer chunk al último', () => {
    const e = new Ensamblador(relojDe(1000, 1010, 1025));
    expect(e.recibir(chunk(0, 3, [1, 2]))).toBe(false);
    expect(e.recibir(chunk(1, 3, [3, 4]))).toBe(false);
    expect(e.recibir(chunk(2, 3, [5]))).toBe(true);
    expect(Array.from(e.payload())).toEqual([1, 2, 3, 4, 5]);
    expect(e.medicion()).toEqual({ bytes: 5, chunks: 3, chunkBytes: 6, ms: 25, kbps: 5 / 25 });
  });

  it('un chunk repetido no suma bytes ni cuenta como chunk', () => {
    const e = new Ensamblador(relojDe(0, 1, 2));
    e.recibir(chunk(0, 2, [1]));
    e.recibir(chunk(0, 2, [1]));
    expect(e.completo).toBe(false);
    e.recibir(chunk(1, 2, [2]));
    expect(e.medicion().bytes).toBe(2);
    expect(e.medicion().chunks).toBe(2);
  });

  it('reporta qué chunks faltan en vez de inventar un número', () => {
    const e = new Ensamblador(relojDe(0, 1));
    e.recibir(chunk(0, 4, [1]));
    e.recibir(chunk(3, 4, [4]));
    expect(e.completo).toBe(false);
    expect(e.faltantes()).toEqual([1, 2]);
    expect(() => e.medicion()).toThrow(BleTransferError);
    try {
      e.payload();
    } catch (err) {
      expect((err as BleTransferError).faltantes).toEqual([1, 2]);
    }
  });

  it('un total distinto entre chunks es otra transferencia mezclada: error', () => {
    const e = new Ensamblador(relojDe(0));
    e.recibir(chunk(0, 2, [1]));
    expect(() => e.recibir(chunk(1, 3, [1]))).toThrow(BleTransferError);
  });

  it('la medición de 53 KB en 182 bytes por chunk da los KB/s esperados', () => {
    const chunks = 298;
    const e = new Ensamblador(relojDe(...Array.from({ length: chunks }, (_, i) => i * 10)));
    for (let seq = 0; seq < chunks; seq++) {
      const largo = seq === chunks - 1 ? 53_000 - 178 * (chunks - 1) : 178;
      e.recibir(chunk(seq, chunks, new Array(largo).fill(0)));
    }
    const m = e.medicion();
    expect(m.bytes).toBe(53_000);
    expect(m.ms).toBe(2970);
    expect(m.kbps).toBeCloseTo(17.85, 2);
  });
});

describe('base64', () => {
  it('ida y vuelta de bytes arbitrarios, incluidos los rellenos de 1 y 2 bytes', () => {
    for (const largo of [0, 1, 2, 3, 4, 5, 182]) {
      const bytes = new Uint8Array(Array.from({ length: largo }, (_, i) => (i * 37 + 11) & 0xff));
      expect(Array.from(decodificarBase64(codificarBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('coincide con el base64 estándar que produce la placa', () => {
    expect(codificarTextoBase64('{"cmd":"medir"}')).toBe('eyJjbWQiOiJtZWRpciJ9');
    expect(decodificarTextoBase64('eyJ0IjoiZmluIn0=')).toBe('{"t":"fin"}');
  });
});
