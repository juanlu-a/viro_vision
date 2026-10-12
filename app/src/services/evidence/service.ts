/**
 * The evidence path wired to the real phone: disk, network, telemetry. The logic lives in
 * `evidence.ts` and `uploadQueue.ts`, tested without any of these.
 *
 * TEMPORARY — DEVELOPMENT ONLY, removed before the final version (see `evidence.ts`).
 *
 * BOUNDARY RULE (ADR 0001): this goes out to the internet. It is wired from `features/device` when
 * the device announces a picture and nothing waits for it; the linter keeps it out of
 * `features/recognition/` and `features/audio/`, so the reading and the announcement can never
 * depend on a picture being pulled or uploaded.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { encodeBase64 } from '@/services/ble/base64';
import { errorDetail, functionUrlFrom, getPhoneId, record } from '@/services/telemetry';
import type { DeviceAddress } from '@/services/wifi/deviceHttp';

import { evidenceDetail, isEvidenceRef, pullEvidence } from './evidence';
import { createUploadQueue, type PendingStore, type PendingUpload, type UploadQueue } from './uploadQueue';

const FOLDER = 'evidence-pending';
const UPLOAD_TIMEOUT_MS = 30_000;

/** Same derivation as telemetry's (`telemetry/config.ts`): the function lives next to the proxy. */
const uploadUrl = process.env.EXPO_PUBLIC_EVIDENCE_URL || functionUrlFrom(process.env.EXPO_PUBLIC_VISION_PROXY_URL, 'evidence') || '';

function fileStore(): PendingStore {
  const folder = new Directory(Paths.cache, FOLDER);
  if (!folder.exists) folder.create({ idempotent: true });
  const file = (key: string) => new File(folder, `${key}.json`);
  return {
    keys: () =>
      folder
        .list()
        .filter((e): e is File => e instanceof File && e.name.endsWith('.json'))
        .map((f) => f.name.slice(0, -'.json'.length))
        .sort(),
    read(key) {
      try {
        return JSON.parse(file(key).textSync()) as PendingUpload;
      } catch {
        return null;
      }
    },
    write(key, item) {
      const f = file(key);
      f.create({ overwrite: true });
      f.write(JSON.stringify(item));
    },
    remove(key) {
      try {
        file(key).delete();
      } catch {
        // Best-effort: a file left behind is retried, and uploading it twice is harmless (upsert).
      }
    },
  };
}

async function upload(item: PendingUpload): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const r = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`evidence answered ${r.status}`);
  } finally {
    clearTimeout(timer);
  }
}

let queue: UploadQueue | null = null;

function getQueue(): UploadQueue {
  queue ??= createUploadQueue({
    store: fileStore(),
    upload,
    onDropped: (ref) => record('bus.evidenceFailed', { detail: { stage: 'dropped', ref } }),
    // Once per failed round, not per picture: on the AP every round fails, and a row per picture would
    // bury the session in its own noise.
    onFailed: (message, pending) => record('bus.evidenceFailed', { detail: { stage: 'upload', message, pending } }),
  });
  return queue;
}

/**
 * The device announced a picture: pull it, log it with where it will be, queue the upload. Never
 * throws and never awaited by anything the user waits on.
 */
export async function handleEvidence(address: DeviceAddress | null, ref: string): Promise<void> {
  if (!isEvidenceRef(ref)) {
    record('bus.evidenceFailed', { detail: { stage: 'ref', ref: ref.slice(0, 80) } });
    return;
  }
  if (address === null) {
    // No WiFi with the device: the picture stays on its card, and the row says where to find it.
    record('bus.evidenceFailed', { detail: { stage: 'noAddress', ref } });
    return;
  }
  const t0 = Date.now();
  try {
    const phone = await getPhoneId();
    const { record: rec, pictures } = await pullEvidence(address, ref);
    record('bus.evidence', { ms: Date.now() - t0, detail: evidenceDetail(rec, phone) });
    if (pictures.length === 0 || uploadUrl === '') return;
    getQueue().enqueue({ phone, ref, files: pictures.map((p) => ({ name: p.name, base64: encodeBase64(p.bytes) })) });
  } catch (err) {
    record('bus.evidenceFailed', { ms: Date.now() - t0, detail: { stage: 'pull', ref, message: errorDetail(err) } });
  }
}
