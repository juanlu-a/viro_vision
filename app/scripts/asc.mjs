/**
 * A minimal App Store Connect API client, with no dependencies: an ES256 JWT signed with the API key.
 *
 * It exists so distribution to TestFlight (groups, "what to test", submission to Beta App Review) is
 * a pipeline step and not clicks in App Store Connect. It reads the key from the environment:
 *   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to AuthKey_XXXX.p8)
 * Only the path and the IDs — the .p8 never enters the repo.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;

if (!KEY_ID || !ISSUER || !KEY_PATH) {
  throw new Error('ASC_KEY_ID, ASC_ISSUER_ID or ASC_KEY_PATH missing from the environment.');
}

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  // 15 min is the maximum Apple accepts; one is issued per request, so it never expires midway.
  const payload = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const key = createPrivateKey(readFileSync(KEY_PATH));
  const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${sig.toString('base64url')}`;
}

export class AscError extends Error {
  constructor(method, path, status, body) {
    super(`ASC_${status}: ${method} ${path}`);
    this.name = 'AscError';
    this.status = status;
    this.body = body;
  }
}

export async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) throw new AscError(method, path, res.status, json);
  return json;
}
