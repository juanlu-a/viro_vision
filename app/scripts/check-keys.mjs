#!/usr/bin/env node
/**
 * Fails if the build is going out WITHOUT any cloud model available.
 *
 * It exists because of a real failure (2026-09-02): when Gemini left the selector, the only provider
 * secret the repo had stopped corresponding to a model in the registry. The build went out to
 * TestFlight with `availableModels()` empty and supermarket mode dead — the app degraded correctly,
 * said "not configured" and did not break, but **nobody found out until opening it**. A build that
 * cannot fulfil half its purpose should not take 30 minutes to say so.
 *
 * What it compares is what drifted apart: the providers the **registry** offers against the keys the
 * **environment** carries. Checking only "is there any key" would have detected nothing, because
 * Gemini's was there; what was missing was a key for a provider *still on the list*.
 *
 * It runs before the build (see .github/workflows/testflight.yml) and locally with `npm run keys`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(root, 'src/services/vision/config.ts'), 'utf8');

/**
 * Locally the keys live in `app/.env` and this script runs with `node`, which does not load it by
 * itself (Expo does for its own commands). Without this, `npm run keys` would say keys are missing
 * that are right there, and the warning would lose credibility exactly where it has to be useful. In
 * CI the file does not exist and the variables come from the environment, so this block does nothing.
 *
 * `process.env` wins: if CI defines a variable, a `.env` that slipped into the runner does not
 * overwrite it.
 */
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  // No .env: that is the CI case.
}

/** Each provider's env var name. Mirrors `apiKeyFor` in config.ts. */
const KEY_OF = {
  gemini: 'EXPO_PUBLIC_GEMINI_API_KEY',
  openai: 'EXPO_PUBLIC_OPENAI_API_KEY',
  anthropic: 'EXPO_PUBLIC_ANTHROPIC_API_KEY',
  groq: 'EXPO_PUBLIC_GROQ_API_KEY',
};

/**
 * The providers the selector offers today, read from the registry.
 *
 * It is scoped to `MODEL_PROFILES` on purpose: `RETIRED_PROFILES` is in the same file and taking its
 * providers would make the check pass with the key of a model the app no longer offers — which is
 * exactly the failure this prevents.
 */
function selectorProviders() {
  const from = config.indexOf('export const MODEL_PROFILES');
  if (from === -1) throw new Error('MODEL_PROFILES was not found in config.ts.');
  const to = config.indexOf('\n];', from);
  if (to === -1) throw new Error('MODEL_PROFILES could not be delimited in config.ts.');

  const block = config.slice(from, to);
  const found = [...block.matchAll(/provider:\s*'([a-z]+)'/g)].map((m) => m[1]);
  if (found.length === 0) throw new Error('MODEL_PROFILES ended up with no models at all.');
  return [...new Set(found)];
}

const providers = selectorProviders();
const proxy = (process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '').trim();
const withKey = providers.filter((p) => (process.env[KEY_OF[p]] ?? '').trim() !== '');

// With the proxy the server holds the keys: having the URL is enough (ADR 0008).
if (proxy !== '') {
  console.log(`✅ Proxy configured (${proxy.replace(/\/\/[^/]+/, '//…')}). The models go out through it.`);
  process.exit(0);
}

if (withKey.length > 0) {
  console.log(`✅ Supermarket mode available with: ${withKey.join(', ')}.`);
  const withoutKey = providers.filter((p) => !withKey.includes(p));
  if (withoutKey.length > 0) {
    console.log(`ℹ️  With no key, these stay out of the selector: ${withoutKey.map((p) => `${p} (${KEY_OF[p]})`).join(', ')}.`);
  }
  process.exit(0);
}

console.error(`
❌ This build would go out WITHOUT supermarket mode.

   The selector offers: ${providers.join(', ')}
   Keys present:        none of those
   Proxy:               not configured

   The app does not break —it says "no configurado" and bus mode keeps reading— but half its purpose
   does not exist in this build, and that is not visible until you open it.

   To fix it, load ONE of these as a repo secret (or in app/.env for a local build):
${providers.map((p) => `     · ${KEY_OF[p]}`).join('\n')}
     · EXPO_PUBLIC_VISION_PROXY_URL   ← the preferable one: the keys stay on the server (ADR 0008)

   RULE (ADR 0008): a FREE key with no card may go into the bundle; a PAID one may not. The bundle is
   readable, and the worst case of a stolen free key is a burnt quota — the worst case of a paid one
   is the project's card. Paid keys wait for the proxy.
`);
process.exit(1);
