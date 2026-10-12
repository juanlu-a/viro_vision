/**
 * Bus mode's pictures, from the device to the telemetry table.
 *
 * TEMPORARY — DEVELOPMENT ONLY. Removed before the final version with the rest of the evidence path
 * (team decision, 2026-10-12; `docs/ROADMAP.md`, "Antes de la versión final"): they are pictures of
 * the street, people included.
 *
 * Why it exists: the telemetry said "115, Luis Braille" and nothing about the picture behind it, and a
 * sign too small, a crop that cut half the destination, glare on the LEDs and an OCR mistake all look
 * the same in text. The device now keeps the frame of each bus and the crop of each OCR read
 * (`hardware/raspi/virovision/evidence.py`) and says so over BLE; this module pulls them the way the
 * supermarket photo is pulled (ADR 0003: told over BLE, downloaded over WiFi) and links them to the
 * log:
 *
 *   - one `bus.evidence` row per record, with what the OCR returned **and the Storage path of every
 *     picture** — recorded the moment it arrives, offline included;
 *   - the JPEGs go to the private `evidence` bucket afterwards, under exactly those paths
 *     (`supabase/functions/evidence`), whenever there is internet (`uploadQueue.ts`).
 *
 * The paths are deterministic (`<phone>/<run>/<file>`) so neither side has to tell the other where
 * things went: the row is right even if the upload happens an hour later.
 *
 * Pure module: no network, no disk. `service.ts` wires it.
 */
import type { DeviceAddress } from '@/services/wifi/deviceHttp';
import { HttpDownloadError, deviceUrl } from '@/services/wifi/deviceHttp';

/** `<run>/t003-r02`: the names the device writes, and nothing else is ever requested. */
const REF = /^\d{8}-\d{6}(?:-\d+)?\/t\d{3}-[a-z0-9-]+$/;
const FILE = /^t\d{3}-[a-z0-9-]+\.jpg$/;

export function isEvidenceRef(ref: string): boolean {
  return REF.test(ref);
}

/** What the device wrote for one record (`evidence.py`). Only the fields read here are typed. */
export interface EvidenceRecord {
  ref: string;
  wall?: string;
  what?: 'bus' | 'read' | 'decided';
  track?: number;
  attempt?: number;
  ocr_ms?: number;
  texts?: { text: string; score: number }[];
  raw?: string | null;
  number?: string | null;
  destination?: string | null;
  confidence?: number | null;
  verified?: boolean;
  inferred?: string[];
  announced?: boolean;
  attempts?: number;
  detections?: { label: string; conf: number }[];
  files?: string[];
  dropped_before?: number;
}

export interface EvidencePicture {
  name: string;
  bytes: Uint8Array;
}

export interface PulledEvidence {
  record: EvidenceRecord;
  pictures: EvidencePicture[];
}

/** Where a picture lives in the bucket. The function writes the same path (`supabase/functions/evidence`). */
export function storagePath(phone: string, ref: string, file: string): string {
  return `${phone}/${ref.split('/')[0]}/${file}`;
}

interface PullDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function get(address: DeviceAddress, path: string, { fetchImpl = fetch, timeoutMs = 10_000 }: PullDeps): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(deviceUrl(address, path), { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new HttpDownloadError(`the device answered ${response.status}`, response.status);
    return response;
  } catch (err) {
    if (err instanceof HttpDownloadError) throw err;
    throw new HttpDownloadError(controller.signal.aborted ? `the device did not answer in ${timeoutMs / 1000} s` : err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

/** The record the device announced, and the pictures it lists. */
export async function pullEvidence(address: DeviceAddress, ref: string, deps: PullDeps = {}): Promise<PulledEvidence> {
  const run = ref.split('/')[0];
  const record = (await (await get(address, `/evidence/${ref}.json`, deps)).json()) as EvidenceRecord;
  const pictures: EvidencePicture[] = [];
  for (const name of (record.files ?? []).filter((f) => FILE.test(f))) {
    const bytes = new Uint8Array(await (await get(address, `/evidence/${run}/${name}`, deps)).arrayBuffer());
    pictures.push({ name, bytes });
  }
  return { record: { ...record, ref }, pictures };
}

/**
 * The `bus.evidence` row's detail: the log line of one picture. Small on purpose — the function
 * replaces a detail over ~6 KB with `{trimmed: true}` and the whole link would be lost — so the OCR's
 * texts are capped and nothing of the image travels here, only where it is.
 */
export function evidenceDetail(record: EvidenceRecord, phone: string): Record<string, unknown> {
  const pictures = (record.files ?? []).filter((f) => FILE.test(f));
  return {
    ref: record.ref,
    what: record.what ?? null,
    track: record.track ?? null,
    attempt: record.attempt ?? null,
    // The device's own clock, the one its journal uses: a row and a journal line match by it. It has
    // no RTC, so it can be hours off the row's `occurred_at` before NTP — both are kept.
    deviceTime: record.wall ?? null,
    ocrMs: record.ocr_ms ?? null,
    texts: (record.texts ?? []).slice(0, 12).map((t) => ({ text: String(t.text).slice(0, 80), score: t.score })),
    raw: record.raw == null ? null : String(record.raw).slice(0, 300),
    number: record.number ?? null,
    destination: record.destination ?? null,
    confidence: record.confidence ?? null,
    verified: record.verified ?? null,
    inferred: record.inferred ?? null,
    announced: record.announced ?? null,
    attempts: record.attempts ?? null,
    detections: (record.detections ?? []).slice(0, 8).map((d) => ({ label: d.label, conf: d.conf })),
    droppedBefore: record.dropped_before ?? 0,
    storage: pictures.map((f) => storagePath(phone, record.ref, f)),
  };
}
