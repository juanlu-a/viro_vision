/**
 * Subida de un .aab a Google Play con la Google Play Developer API, sin dependencias.
 *
 * Espejo de testflight-distribute.mjs para Android. Autenticación con una *service account*
 * (JSON de Google Cloud, con permiso de releases en Play Console): JWT RS256 → access token.
 * Flujo de la API: edits.insert → bundles.upload → tracks.update → edits.commit.
 *
 * Pistas (Google) ↔ grupos (Apple), decisión del 2026-08-30:
 *   - `internal`: hasta 100 testers por email, sin revisión de Google, llega en minutos
 *     (= grupo interno "Equipo"). Recibe `staging`.
 *   - `alpha` (closed testing): testers por lista o link de opt-in; la primera release pasa por
 *     revisión de Google (= grupo externo "Testers"). Recibe `main`.
 *
 * Uso:
 *   PLAY_SA_PATH=… node scripts/gplay.mjs --aab ruta.aab --track internal --notes "Qué cambió"
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
const notes = args.notes || 'Build automático.';
if (!aabPath) {
  console.error('Uso: --aab ruta.aab [--track internal|alpha] [--notes "texto"]');
  process.exit(2);
}
const saPath = process.env.PLAY_SA_PATH;
if (!saPath) throw new Error('Falta PLAY_SA_PATH (JSON de la service account).');

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
console.log('aab subido, versionCode', bundle.versionCode);

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
console.log(`✓ versionCode ${bundle.versionCode} → pista "${track}" en Google Play`);
