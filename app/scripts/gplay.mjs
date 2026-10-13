/**
 * Upload of an .aab to Google Play with the Google Play Developer API, with no dependencies.
 *
 * A mirror of testflight-distribute.mjs for Android. Authentication with a *service account* (a
 * Google Cloud JSON, with release permission in the Play Console): RS256 JWT → access token.
 * API flow: edits.insert → bundles.upload → tracks.update → edits.commit.
 *
 * Tracks (Google) ↔ groups (Apple), decision of 2026-08-30:
 *   - `internal`: up to 100 testers by email, no Google review, arrives in minutes (= the internal
 *     "Equipo" group). It receives `staging`.
 *   - `alpha` (closed testing): testers by list or opt-in link; the first release goes through
 *     Google's review (= the external "Testers" group). It receives `main`.
 *
 * Usage:
 *   PLAY_SA_PATH=… node scripts/gplay.mjs --aab path.aab --track internal --notes "What changed"
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] ?? '']);
    return acc;
  }, []),
);
const aabPath = args.aab;
const track = args.track || 'internal';
const notes = args.notes || 'Automatic build.';
if (!aabPath) {
  console.error('Usage: --aab path.aab [--track internal|alpha] [--notes "text"]');
  process.exit(2);
}
const saPath = process.env.PLAY_SA_PATH;
if (!saPath) throw new Error('PLAY_SA_PATH missing (the service account JSON).');

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
const pkg = appJson.expo.android.package;
const sa = JSON.parse(readFileSync(saPath, 'utf8'));

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const sig = sign('sha256', Buffer.from(`${header}.${payload}`), createPrivateKey(sa.private_key));
  const assertion = `${header}.${payload}.${sig.toString('base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const token = await accessToken();
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
async function api(method, path, body, raw = false) {
  const res = await fetch(`${path.startsWith('http') ? '' : base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': raw ? 'application/octet-stream' : 'application/json',
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

const edit = await api('POST', '/edits');
console.log('edit', edit.id);

const bundle = await api(
  'POST',
  `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${pkg}/edits/${edit.id}/bundles?uploadType=media`,
  readFileSync(aabPath),
  true,
);
console.log('aab uploaded, versionCode', bundle.versionCode);

await api('PUT', `/edits/${edit.id}/tracks/${track}`, {
  track,
  releases: [
    {
      versionCodes: [String(bundle.versionCode)],
      status: 'completed',
      releaseNotes: [{ language: 'es-419', text: notes.slice(0, 500) }],
    },
  ],
});
await api('POST', `/edits/${edit.id}:commit`);
console.log(`✓ versionCode ${bundle.versionCode} → "${track}" track on Google Play`);
