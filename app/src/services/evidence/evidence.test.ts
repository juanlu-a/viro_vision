/**
 * Exists because the whole value of a bus mode picture is its link to the log: the `bus.evidence` row
 * has to name the exact Storage path the upload will use, the OCR's words have to survive the
 * telemetry function's 6 KB cap, and the app must never ask the device for a path it did not announce.
 */
import { evidenceDetail, isEvidenceRef, pullEvidence, storagePath } from './evidence';

const address = { ip: '10.42.0.1', port: 8080 };
const REF = '20261012-101500/t003-r02';

function fakeFetch(files: Record<string, unknown>) {
  const asked: string[] = [];
  const impl = (async (url: string) => {
    const path = url.replace('http://10.42.0.1:8080', '');
    asked.push(path);
    const body = files[path];
    if (body === undefined) return { ok: false, status: 404 } as Response;
    return {
      ok: true,
      status: 200,
      json: async () => body,
      arrayBuffer: async () => (body as Uint8Array).buffer,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, asked };
}

describe('pullEvidence', () => {
  it('downloads the announced record and the pictures it lists, and nothing else', async () => {
    const { impl, asked } = fakeFetch({
      [`/evidence/${REF}.json`]: { ref: REF, what: 'read', files: ['t003-r02-crop.jpg', '../../etc/passwd'] },
      '/evidence/20261012-101500/t003-r02-crop.jpg': new Uint8Array([0xff, 0xd8, 1]),
    });
    const pulled = await pullEvidence(address, REF, { fetchImpl: impl });
    expect(pulled.pictures.map((p) => p.name)).toEqual(['t003-r02-crop.jpg']);
    expect(asked).toEqual([`/evidence/${REF}.json`, '/evidence/20261012-101500/t003-r02-crop.jpg']);
  });

  it('fails with the typed download error when the device does not have it', async () => {
    const { impl } = fakeFetch({});
    await expect(pullEvidence(address, REF, { fetchImpl: impl })).rejects.toMatchObject({ name: 'HttpDownloadError', status: 404 });
  });
});

describe('evidenceDetail', () => {
  it('names every picture by the path the evidence function stores it under', () => {
    const detail = evidenceDetail({ ref: REF, files: ['t003-r02-crop.jpg', 't003-r02-frame.jpg'], number: '115' }, 'phone-abc');
    expect(detail.storage).toEqual(['phone-abc/20261012-101500/t003-r02-crop.jpg', 'phone-abc/20261012-101500/t003-r02-frame.jpg']);
    expect(storagePath('phone-abc', REF, 'x.jpg')).toBe('phone-abc/20261012-101500/x.jpg');
    expect(detail.number).toBe('115');
  });

  it('stays far under the telemetry cap even with a flood of OCR texts', () => {
    const texts = Array.from({ length: 200 }, (_, i) => ({ text: 'Ñ'.repeat(500) + i, score: 0.5 }));
    const detail = evidenceDetail({ ref: REF, texts, raw: 'x'.repeat(10_000) }, 'phone-abc');
    expect(new TextEncoder().encode(JSON.stringify(detail)).length).toBeLessThan(6_000);
  });
});

describe('isEvidenceRef', () => {
  it('accepts only names the device writes', () => {
    expect(isEvidenceRef(REF)).toBe(true);
    expect(isEvidenceRef('20261012-101500-2/t001-bus')).toBe(true);
    expect(isEvidenceRef('../secret')).toBe(false);
    expect(isEvidenceRef('20261012-101500/t003-r02/../../x')).toBe(false);
  });
});
