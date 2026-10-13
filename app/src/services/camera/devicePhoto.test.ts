/**
 * Exists because this is the ONLY photo entering the reader since the phone's camera left: if the
 * base64 came out wrong the model would receive garbage with no visible error, and if a 503 from the
 * device ("no camera") could not be told apart from a timeout, the app would give the wrong reason.
 */
import { HttpDownloadError } from '@/services/wifi/deviceHttp';

import { downloadDevicePhoto } from './devicePhoto';

const address = { ip: '10.42.0.1', port: 8080 };

function fakeFetch(body: Uint8Array, status = 200): typeof fetch {
  return (async () =>
    ({ ok: status < 300, status, arrayBuffer: async () => body.buffer.slice(0) }) as unknown as Response) as unknown as typeof fetch;
}

describe('downloadDevicePhoto', () => {
  it('returns the JPEG as standard base64, the stored uri and the elapsed time', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    let t = 100;
    const photo = await downloadDevicePhoto(address, {
      fetchImpl: fakeFetch(jpeg),
      now: () => (t += 120),
      save: () => 'file:///cache/device.jpg',
    });
    expect(photo.image).toEqual({ imageBase64: '/9j/4AA=', mediaType: 'image/jpeg' });
    expect(photo.uri).toBe('file:///cache/device.jpg');
    expect(photo.bytes).toBe(5);
    expect(photo.ms).toBe(120);
  });

  it('a 503 is explained as "no camera"', async () => {
    await expect(
      downloadDevicePhoto(address, { fetchImpl: fakeFetch(new Uint8Array(0), 503), save: () => '' })
    ).rejects.toMatchObject({ name: 'HttpDownloadError', status: 503, message: 'the device has no camera' });
    expect(new HttpDownloadError('x').name).toBe('HttpDownloadError');
  });
});
