/**
 * Bus mode's pictures: receives the JPEGs the app pulled from the device and stores them in the
 * private `evidence` bucket (migration `20261012120000_evidence_bucket.sql`).
 *
 * TEMPORARY — development only. Removed before the final version with the rest of the evidence path
 * (`docs/ROADMAP.md`, "Antes de la versión final"): they are pictures of the street, people included.
 *
 * The other half of the link is the `bus.evidence` telemetry row, which the app records with the
 * same storage paths this function writes: `<phone>/<run>/<file>`. The paths are deterministic on
 * purpose, so the row can be recorded the moment the picture is seen — offline included — and the
 * upload can happen later without either side having to tell the other where things went.
 *
 * Without user auth (`verify_jwt = false`), like `telemetry` and `vision` (ADR 0008): the app has no
 * accounts. The cost of abuse is junk in a private development bucket, bounded by the caps below and
 * by the bucket's own size and type limits.
 *
 *   POST { phone, ref: "<run>/t003-r02", files: [{ name: "t003-r02-crop.jpg", base64 }] }
 *   →    { stored: ["<phone>/<run>/t003-r02-crop.jpg", …] }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { clientIp, createBrake, isObject, readCapped } from '../_shared/http.ts';

const BUCKET = 'evidence';
/** A crop and a 1024 px frame at q85 are ~10 KB and ~150 KB; four of them, base64, fit easily. */
const MAX_BODY_BYTES = 6_000_000;
const MAX_FILES = 4;
const MAX_FILE_BYTES = 2_000_000;

/** The names the device writes (`hardware/raspi/virovision/evidence.py`), and nothing else. */
const PHONE = /^[A-Za-z0-9_-]{1,64}$/;
// `\d{3,}`: the device pads to three digits, and a long run goes past track 999.
const REF = /^(\d{8}-\d{6}(?:-\d+)?)\/t\d{3,}-[a-z0-9-]+$/;
const FILE = /^t\d{3,}-[a-z0-9-]+\.jpg$/;

/**
 * A per-IP brake, the same speed bump as `vision`'s and with the same limits on what it can know
 * (one count per isolate, the IP from a header). Without one, a loop of valid-shaped POSTs wrote
 * up to 6 MB a request into the bucket with the service role. A field run uploads a few pictures a
 * minute; 60 leaves plenty of room.
 */
const overTheBrake = createBrake(60_000, 60);

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Storage's answer for a path that already holds an object (HTTP 409, "already exists"). */
function alreadyStored(error: { message?: string; statusCode?: string | number }): boolean {
  return String(error.statusCode) === '409' || /already exists|duplicate/i.test(error.message ?? '');
}

function decode(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return reply(405, { error: 'POST' });
  if (overTheBrake(clientIp(request), Date.now())) return reply(429, { error: 'too many' });
  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return reply(413, { error: 'too large' });

  let body: { phone?: unknown; ref?: unknown; files?: unknown };
  try {
    const text = await readCapped(request, MAX_BODY_BYTES);
    if (text === null) return reply(413, { error: 'too large' });
    const parsed: unknown = JSON.parse(text);
    if (!isObject(parsed)) return reply(400, { error: 'invalid JSON' });
    body = parsed;
  } catch {
    return reply(400, { error: 'invalid JSON' });
  }

  const { phone, ref, files } = body;
  if (typeof phone !== 'string' || !PHONE.test(phone)) return reply(400, { error: 'invalid phone' });
  const match = typeof ref === 'string' ? REF.exec(ref) : null;
  if (!match) return reply(400, { error: 'invalid ref' });
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) return reply(400, { error: 'invalid files' });

  const run = match[1];
  const uploads: { path: string; bytes: Uint8Array }[] = [];
  for (const file of files as { name?: unknown; base64?: unknown }[]) {
    if (typeof file?.name !== 'string' || !FILE.test(file.name) || typeof file.base64 !== 'string') {
      return reply(400, { error: 'invalid file' });
    }
    const bytes = decode(file.base64);
    // A JPEG starts with FF D8: anything else is not a picture the device took.
    if (!bytes || bytes.length > MAX_FILE_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return reply(400, { error: `invalid image ${file.name}` });
    }
    uploads.push({ path: `${phone}/${run}/${file.name}`, bytes });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const stored: string[] = [];
  for (const { path, bytes } of uploads) {
    // No upsert: this endpoint answers anyone, and with it a known path could be overwritten. A retry
    // after a response that never reached the phone finds the file already there, and that is a
    // success: the paths are deterministic, so the same path is the same picture.
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error && alreadyStored(error)) {
      stored.push(path);
      continue;
    }
    if (error) {
      console.error('evidence: upload failed:', path, error.message);
      // The storage message stays in the server's log: this endpoint answers anyone.
      return reply(500, { error: 'could not store', stored });
    }
    stored.push(path);
  }
  return reply(200, { stored });
});
