/**
 * Existe porque esta foto entra al mismo pipeline de nube que la del teléfono: si el base64 saliera
 * distinto del que produce `prepararParaLaNube`, el modelo recibiría basura sin ningún error visible.
 */
import { HttpDescargaError } from '@/services/wifi/descargaHttp';

import { descargarFotoDeLaPlaca } from './fotoDeLaPlaca';

const direccion = { ip: '10.42.0.1', puerto: 8080 };

function fetchFalso(cuerpo: Uint8Array, status = 200): typeof fetch {
  return (async () =>
    ({ ok: status < 300, status, arrayBuffer: async () => cuerpo.buffer.slice(0) }) as unknown as Response) as unknown as typeof fetch;
}

describe('descargarFotoDeLaPlaca', () => {
  it('devuelve el JPEG como base64 estándar, el uri guardado y el tiempo', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    let t = 100;
    const foto = await descargarFotoDeLaPlaca(direccion, {
      fetchImpl: fetchFalso(jpeg),
      now: () => (t += 120),
      guardar: () => 'file:///cache/placa.jpg',
    });
    expect(foto.imagen).toEqual({ imageBase64: '/9j/4AA=', mediaType: 'image/jpeg' });
    expect(foto.uri).toBe('file:///cache/placa.jpg');
    expect(foto.bytes).toBe(5);
    expect(foto.ms).toBe(120);
  });

  it('un 503 se explica como "sin cámara"', async () => {
    await expect(
      descargarFotoDeLaPlaca(direccion, { fetchImpl: fetchFalso(new Uint8Array(0), 503), guardar: () => '' })
    ).rejects.toMatchObject({ name: 'HttpDescargaError', status: 503, message: 'la placa no tiene cámara' });
    expect(new HttpDescargaError('x').name).toBe('HttpDescargaError');
  });
});
