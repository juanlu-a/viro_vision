/**
 * Speech synthesis **to a file**, for the device's speaker.
 *
 * It does not replace the announcement. `expo-speech` (see `tts.ts`) still says the reading through
 * the phone's speaker, instantly and without network; this additionally leaves an `.mp3` on disk,
 * which is what in the agreed diagram travels from the smartphone to the device's speaker over
 * BLE/WiFi (`docs/architecture/README.md`). `expo-speech` uses the system engine and **does not
 * export to a file**, so the file has to come from a cloud TTS.
 *
 * **Off by default.** Nothing consumes the file today: the hardware does not exist, and when it does
 * there is an open decision (ADR 0003) that may make it unnecessary — if the transport ends up being
 * BLE, it may be better for the Raspberry Pi to do its own TTS and only receive the JSON. A ~3 s MP3
 * at 32 kbps is ~12 KB: over WiFi that is nothing, over GATT it is on the order of seconds. In the
 * meantime, leaving it on would mean paying for an API call on every reading to produce a file
 * nobody opens.
 *
 * **It never blocks the announcement.** It is called after `announce()` and without `await` on the
 * critical path: if it fails, the user has already heard the product. That is what it means for
 * accessibility to be the design criterion and not a layer — the file exists for hardware that does
 * not exist yet, and it cannot degrade what works today.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { isProxyConfigured, proxyUrl, resolveTransport } from '@/services/cloud';
import type { CloudRequest } from '@/services/cloud';

import { SpeechNotConfiguredError, SpeechHttpError } from './errors';

/** Turned on with `EXPO_PUBLIC_AUDIO_FILE_ENABLED=1`. See the comment above. */
export const isSynthesisEnabled = (process.env.EXPO_PUBLIC_AUDIO_FILE_ENABLED ?? '') === '1';

const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

/**
 * OpenAI's TTS is used and not Google's for two concrete reasons:
 *   - an AI Studio key (the Gemini one we already have) does **not** have the Cloud Text-to-Speech
 *     API enabled: they are different projects, so the key we already have is of no use;
 *   - Gemini's native TTS returns **raw PCM**, not MP3, and the WAV header would have to be built by
 *     hand in React Native.
 * This one returns the MP3 directly and uses the OpenAI key the model selector already needs.
 */
const VOICE_MODEL = 'gpt-4o-mini-tts';
const VOICE = 'alloy';

/** The API's cap. Truncating is preferable to a 400 that leaves the user without a file and without a reason. */
export const MAX_CHARACTERS = 4096;

/** Folder for the audio files. `cache` and not `document`: they are regenerable and the system may clean them. */
const FOLDER = 'readings';

/**
 * Builds the speech request. Pure module, no network — see `synthesis.test.ts`.
 *
 * It goes out through the same proxy as the product reading (ADR 0008): `/v1/audio/speech` lives on
 * `api.openai.com`, which is already on the function's allowlist. Validating by host and not by exact
 * URL is what makes this need no change on the server side.
 *
 * `apiKey` and `proxy` are injectable **so the test does not depend on the environment**, which is
 * the lesson of a real failure: the previous version read them only from `process.env`, and the test
 * claiming "with no proxy it goes straight to OpenAI" passed locally —jest does not load `.env`— and
 * failed in the publishing job, where the proxy variable is set. The test was measuring the
 * environment, not the code. Same criterion as the quota limiter's injectable clock.
 */
export function buildSpeechRequest(
  text: string,
  apiKey: string = openaiApiKey,
  proxy: string = proxyUrl,
): CloudRequest {
  return resolveTransport(
    {
      url: OPENAI_SPEECH_URL,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: {
        model: VOICE_MODEL,
        voice: VOICE,
        input: text.slice(0, MAX_CHARACTERS),
        response_format: 'mp3',
      },
    },
    'openai',
    proxy,
  );
}

/** A stable, sortable name, so the folder can be inspected to find the latest reading. */
export function speechFileName(when: Date): string {
  return `reading-${when.toISOString().replace(/[:.]/g, '-')}.mp3`;
}

/**
 * Synthesizes `text` and leaves it on disk. Returns the file's `file://` URI.
 *
 * It throws a typed error instead of returning null: the caller decides whether to ignore it (the
 * reading path ignores it on purpose) or to show it (a diagnostics screen would want to see it).
 */
export async function synthesizeToFile(
  text: string,
  when: Date = new Date(),
): Promise<string> {
  if (!isSynthesisEnabled) throw new SpeechNotConfiguredError('AUDIO_FILE_DISABLED');
  // With the proxy on, the server supplies the key, so not having it here is not a problem.
  if (!isProxyConfigured && openaiApiKey === '') {
    throw new SpeechNotConfiguredError('NO_KEY_NO_PROXY');
  }

  const request = buildSpeechRequest(text);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    throw new SpeechHttpError(response.status, await response.text());
  }

  // The endpoint returns the MP3 as binary, not base64: bytes have to be written, not a string.
  const bytes = new Uint8Array(await response.arrayBuffer());

  const folder = new Directory(Paths.cache, FOLDER);
  if (!folder.exists) folder.create({ idempotent: true });

  const file = new File(folder, speechFileName(when));
  file.create({ overwrite: true });
  file.write(bytes);

  return file.uri;
}
