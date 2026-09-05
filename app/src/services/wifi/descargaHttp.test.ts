/**
 * Existe porque este número se compara con el de BLE para decidir el transporte de la foto
 * (ADR 0003): si midiera sólo la cabecera y no el cuerpo, o no distinguiera un 503 de la placa
 * ("sin cámara") de un timeout, la tabla de mediciones diría cualquier cosa.
 */
import { HttpDescargaError, medirDescargaHttp, urlDeLaPlaca } from './descargaHttp';

function fetchFalso(cuerpo: Uint8Array, status = 200, demoraCuerpo: () => void = () => {}): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () => {
        demoraCuerpo();
        return cuerpo.buffer.slice(cuerpo.byteOffset, cuerpo.byteOffset + cuerpo.byteLength);
      },
    }) as unknown as Response) as unknown as typeof fetch;
}

function relojDe(...instantes: number[]): () => number {
  let i = 0;
  return () => instantes[Math.min(i++, instantes.length - 1)];
}

describe('urlDeLaPlaca', () => {
  it('arma la URL en HTTP plano con la ip y el puerto que llegan por el GATT', () => {
    expect(urlDeLaPlaca({ ip: '192.168.1.145', puerto: 8080 }, '/medir/53000')).toBe(
      'http://192.168.1.145:8080/medir/53000'
    );
  });
});

describe('medirDescargaHttp', () => {
  it('mide hasta el último byte del cuerpo, no hasta la cabecera', async () => {
    const reloj = relojDe(1000, 1046);
    const m = await medirDescargaHttp('http://x/medir/53000', {
      fetchImpl: fetchFalso(new Uint8Array(53_000)),
      now: reloj,
    });
    expect(m).toEqual({ bytes: 53_000, chunks: 1, chunkBytes: 53_000, ms: 46, kbps: 53_000 / 46 });
  });

  it('un estado de error de la placa se reporta con su código', async () => {
    await expect(
      medirDescargaHttp('http://x/fotos/ultima', { fetchImpl: fetchFalso(new Uint8Array(0), 503) })
    ).rejects.toMatchObject({ name: 'HttpDescargaError', status: 503 });
  });

  it('una red que no responde vence por timeout con un mensaje claro', async () => {
    const fetchColgado = ((_: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    await expect(medirDescargaHttp('http://x/medir/1', { fetchImpl: fetchColgado, timeoutMs: 20 })).rejects.toThrow(
      HttpDescargaError
    );
  });
});
