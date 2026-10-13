/**
 * Exists because the two ways of breaking this do not fail visibly.
 *
 * The first: if the speech request did not go through the transport, the OpenAI key would travel
 * from the phone and synthesis would work **just as well** — exactly what ADR 0008 exists to
 * prevent, with no symptom at all. The second: going past the 4096 characters the API accepts is a
 * 400 that leaves the user without a file, and a product reading's text is short today but the label
 * detail (an optional goal of the thesis) can grow.
 *
 * **Every case passes the proxy explicitly and none reads the environment.** The previous version
 * assumed no proxy was configured: it passed locally, where jest does not load `.env`, and failed in
 * the publishing job, where the variable is set. A test that changes result depending on where it
 * runs is not verifying the code.
 */
import { buildSpeechRequest, MAX_CHARACTERS, speechFileName } from './synthesis';

/** No proxy: the direct path, the local development one. */
const DIRECT = '';
const PROXY = 'https://project.supabase.co/functions/v1/vision';

describe('buildSpeechRequest', () => {
  it('asks the voice model for MP3, with the text as input', () => {
    const body = buildSpeechRequest('arroz Saman, Blue Patna 1 kg', 'sk-secret', DIRECT).body as {
      model: string;
      input: string;
      response_format: string;
      voice: string;
      instructions: string;
    };

    expect(body.response_format).toBe('mp3');
    expect(body.input).toBe('arroz Saman, Blue Patna 1 kg');
    expect(body.model).toBe('gpt-4o-mini-tts');
    expect(body.voice).toBeTruthy();
  });

  it('asks for the reading in Spanish', () => {
    // Heard on the device on 2026-09-11: with no `instructions` the board read «Macarrones Adria»
    // with an English accent, because `alloy` defaults to English and a three-word product name with
    // brands in it is not enough for the model to switch. The phone never had the problem —
    // `expo-speech` is told `es-UY` — so nobody noticed until the board's speaker worked.
    const { instructions } = buildSpeechRequest('macarrones Adria', 'sk-secret', DIRECT).body as {
      instructions: string;
    };

    expect(instructions.toLowerCase()).toContain('español');
  });

  it('truncates at the API cap instead of eating a 400', () => {
    const long = 'a'.repeat(MAX_CHARACTERS + 500);
    const { input } = buildSpeechRequest(long, 'sk-secret', DIRECT).body as { input: string };

    expect(input).toHaveLength(MAX_CHARACTERS);
  });

  it('with no proxy it goes straight to OpenAI, with the key in the header', () => {
    const request = buildSpeechRequest('hola', 'sk-secret', DIRECT);

    expect(request.url).toBe('https://api.openai.com/v1/audio/speech');
    expect(request.headers.authorization).toBe('Bearer sk-secret');
  });

  it('with a proxy, the key does NOT travel', () => {
    // It is the whole point of ADR 0008, and the way to break it does not fail visibly: if the
    // request stopped going through the transport, synthesis would work just as well while the key
    // leaves the phone. Speech goes out through the same proxy as the product reading.
    const request = buildSpeechRequest('hola', 'sk-secret', PROXY);

    expect(request.url).toBe(PROXY);
    expect(JSON.stringify(request)).not.toContain('sk-secret');
    expect(request.body).toMatchObject({
      provider: 'openai',
      url: 'https://api.openai.com/v1/audio/speech',
    });
  });
});

describe('speechFileName', () => {
  it('is alphabetically sortable and free of characters that break a path', () => {
    // The ISO colons are not valid on several file systems, and sorting by name is how the latest
    // reading is found by looking at the folder.
    const name = speechFileName(new Date('2026-09-01T18:30:05.123Z'));

    expect(name).toBe('reading-2026-09-01T18-30-05-123Z.mp3');
    expect(name).not.toContain(':');
    expect(speechFileName(new Date('2026-09-01T18:30:04.000Z')) < name).toBe(true);
  });
});
