/**
 * Speech synthesis **to a file**, for the device's speaker.
 *
 * It does not replace the announcement. `expo-speech` (see `tts.ts`) still says the reading through
 * the phone's speaker, instantly and without network; this additionally leaves an `.mp3` on disk,
 * which is what in the agreed diagram travels from the smartphone to the device's speaker over
 * BLE/WiFi (`docs/architecture/README.md`). `expo-speech` uses the system engine and **does not
 * export to a file**, so the file has to come from a cloud TTS.
 *
 * **Off by default** (`EXPO_PUBLIC_AUDIO_FILE_ENABLED=1` turns it on). It is the cost switch: every
 * synthesis is a paid cloud call, so a build that does not send audio to the device must not make
 * one. A ~3 s MP3 at 32 kbps is ~12 KB: over WiFi that is nothing, over GATT it is on the order of
 * seconds, which is why the file travels by HTTP over WiFi (ADR 0003).
 *
 * **Who consumes it.** The reading pipeline (`sendReadingToDevice` in
 * `features/reader/readingService.ts`) synthesizes and **awaits** the send when the user chose the
 * device's speaker: there the file can be the only output, and it has to finish inside the audio
 * session that `requestReading` holds open (the phone locked in a pocket). It never throws, and on
 * any failure the caller falls back to the phone, so the user is never left with silence. Bus mode
 * still sends a best-effort, unawaited copy that never blocks the announcement.
 */
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { isProxyConfigured, proxyUrl, resolveTransport } from '@/services/cloud';
import type { CloudRequest } from '@/services/cloud';
import { cacheFolder } from '@/services/storage/cacheFolder';

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

/**
 * How the sentence has to be said. **In Spanish, and that is the whole point of it being here.**
 *
 * Verified on the device on 2026-09-11: without this the board read «Macarrones Adria» with an
 * English accent. The request only carried `model`, `voice` and `input`, and `alloy` defaults to
 * English — the model infers the language from the text, but a three-word product name with brands
 * in it is not enough for it to switch. On the phone the problem never existed, because `expo-speech`
 * is told `es-UY` explicitly (`tts.ts`); the cloud path had no equivalent and nobody had heard it
 * until the board's speaker worked.
 *
 * It is `instructions` and not a voice change because that is the parameter `gpt-4o-mini-tts` exposes
 * for accent, tone and pace — it is the model's distinguishing feature, and `tts-1` ignores it.
 *
 * In Spanish like the supermarket prompt (ADR 0009): what it governs is **what a person hears**.
 *
 * The steering is reported to be inconsistent for accents. If an English accent ever comes back, the
 * next lever is the voice, not a longer instruction.
 */
const VOICE_INSTRUCTIONS = [
  'Hablá en español rioplatense, neutro y claro, como se habla en Montevideo.',
  'Ritmo pausado y dicción nítida: quien escucha no ve la pantalla y la frase no se repite.',
  'Sin emoción agregada ni entonación publicitaria. Leé las marcas como se pronuncian en español.',
].join(' ');

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
        instructions: VOICE_INSTRUCTIONS,
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
  signal?: AbortSignal,
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
    signal,
  });

  if (!response.ok) {
    throw new SpeechHttpError(response.status, await response.text());
  }

  // The endpoint returns the MP3 as binary, not base64: bytes have to be written, not a string.
  const bytes = new Uint8Array(await response.arrayBuffer());

  // The previous one may still be playing on the device; older ones are never read again.
  const folder = cacheFolder(FOLDER, 1);

  const file = new File(folder, speechFileName(when));
  file.create({ overwrite: true });
  file.write(bytes);

  return file.uri;
}
