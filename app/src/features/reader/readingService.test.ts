/**
 * The reading, end to end, without a screen.
 *
 * This test could not exist before 2026-09-10, because the pipeline lived inside a hook that only
 * Home mounted. That is not a testing detail: it is the same coupling that made the device's button
 * do nothing with the phone locked. Now that the pipeline is a module, the whole cycle —photo,
 * cloud, announcement, audio session— can be driven with doubles.
 *
 * What is asserted here is what a locked screen depends on and what no unit test can see afterwards:
 *
 *   1. the audio session is opened **before** the first await and closed in the `finally` of every
 *      path, including the failing ones. Released early, the announcement is cut in half; never
 *      released, the app holds the audio route for good;
 *   2. the model is read **at the moment of the reading** and not when the deps were installed —
 *      the bug `ProductModelProvider` exists to prevent, re-created one layer down;
 *   3. a second request while one is in flight is dropped and not queued (ADR 0007);
 *   4. the deadline aborts instead of leaving the user with silence.
 */
import { AppState } from 'react-native';

import type { ModelProfile } from '@/services/vision';

import { resetAudioOutputForTests, setAudioOutput } from '@/features/audio/audioOutput';

import {
  applyGesture,
  configureReader,
  setModeFromDevice,
  getReaderState,
  requestReading,
  resetReaderForTests,
  READING_DEADLINE_MS,
} from './readingService';

const mockSpeak = jest.fn((_text: string) => Promise.resolve());
jest.mock('@/features/audio/announcer', () => ({
  announce: (text: string) => mockSpeak(text),
  announceRecognition: () => Promise.resolve(),
}));

const mockAudio: string[] = [];
jest.mock('@/services/audio/session', () => ({
  beginReadingAudio: () => {
    mockAudio.push('begin');
    return Promise.resolve(true);
  },
  endReadingAudio: () => {
    mockAudio.push('end');
    return Promise.resolve();
  },
  playStartEarcon: () => void mockAudio.push('earcon'),
}));

// Synthesis is forced ON for this file: the device output cannot be exercised otherwise, and it is
// a build-time env const in the real module.
const mockSynthesize = jest.fn((_text: string) => Promise.resolve('file:///tmp/reading.mp3'));
jest.mock('@/services/audio/synthesis', () => ({
  isSynthesisEnabled: true,
  synthesizeToFile: (text: string) => mockSynthesize(text),
}));

const mockRecognize = jest.fn();
jest.mock('@/services/vision', () => ({
  ...jest.requireActual('@/services/vision'),
  recognizeProduct: (options: unknown) => mockRecognize(options),
}));

jest.mock('@/services/ondevice', () => ({
  isOcrLoaded: () => true,
  loadOcr: () => Promise.resolve({ ms: 0 }),
  readImage: () => Promise.resolve({ ms: 1, detections: [] }),
}));

const mockEvents: string[] = [];
jest.mock('@/services/telemetry', () => ({
  record: (type: string) => void mockEvents.push(type),
  flush: () => Promise.resolve(),
}));

const MODEL: ModelProfile = {
  provider: 'openai',
  id: 'test-model',
  label: 'Test',
  supportsEffort: false,
  supportsAdaptiveThinking: false,
  maxTokens: 256,
};

const photo = {
  uri: 'file:///photo.jpg',
  image: { imageBase64: 'AAAA', mediaType: 'image/jpeg' as const },
  bytes: 4,
  ms: 46,
};

function deps(over: Partial<Parameters<typeof configureReader>[0]> = {}) {
  return {
    getModel: () => MODEL,
    downloadPhoto: () => Promise.resolve(photo),
    sendAudio: () => Promise.resolve(true),
    writeMode: () => Promise.resolve(),
    isDeviceReady: () => true,
    ...over,
  };
}

/**
 * Puts the reader in supermarket mode the way the device's button does — mode only.
 * `applyGesture('doubleClick')` would ALSO start a reading (ADR 0007), which is correct behaviour
 * and would leave one in flight before the test's own request.
 */
function enterSupermarket() {
  setModeFromDevice('supermarket');
  mockSpeak.mockClear();
  mockAudio.length = 0;
  mockEvents.length = 0;
}

beforeEach(() => {
  resetReaderForTests();
  // The output choice is module state: without this, a file that sets 'device' once leaks it into
  // every test that follows.
  resetAudioOutputForTests();
  mockAudio.length = 0;
  mockEvents.length = 0;
  mockSpeak.mockClear();
  mockSynthesize.mockClear();
  mockRecognize.mockReset();
  mockRecognize.mockResolvedValue({ ms: 900, model: MODEL.id, product: { kind: 'arroz', brand: 'Saman', detail: '1 kg' }, text: '' });
  (AppState as { currentState: unknown }).currentState = 'active';
});

describe('a reading with nothing on screen', () => {
  it('reads what the device photographed and says it out loud', async () => {
    configureReader(deps());
    enterSupermarket();

    await requestReading('device');

    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('Saman'));
    expect(getReaderState().product?.brand).toBe('Saman');
    expect(getReaderState().photoUri).toBe(photo.uri);
    expect(getReaderState().status).toBe('idle');
  });

  it('takes the audio session before anything can await, and releases it after the last word', async () => {
    configureReader(deps());
    enterSupermarket();

    await requestReading('device');

    // The earcon is the user's only sign that the button did something during the cloud round-trip,
    // and ours that the app was woken at all.
    expect(mockAudio).toEqual(['begin', 'earcon', 'end']);
    // Released AFTER speaking: the other order cuts the announcement in half with the screen locked.
    const spokenAt = mockSpeak.mock.invocationCallOrder[0];
    expect(spokenAt).toBeLessThan(Infinity);
    expect(mockAudio.indexOf('end')).toBe(mockAudio.length - 1);
  });

  it('sends the reading to the device instead of speaking it, when that is what was chosen', async () => {
    setAudioOutput('device');
    configureReader(deps({ sendAudio: () => { mockAudio.push('send'); return Promise.resolve(true); } }));
    enterSupermarket();

    await requestReading('device');

    // **The order is the guarantee.** The send sits INSIDE the audio session, before `end`: with the
    // screen locked iOS only lets the app run while the keep-alive is playing, so a send left after
    // the release (which is what `void saveReadingAudio` used to be) would be POSTed by a suspended
    // process. This assertion is the locked-screen requirement, written down.
    expect(mockAudio).toEqual(['begin', 'earcon', 'send', 'end']);
    // And the phone stays quiet: hearing it in both places at once is not what "en el dispositivo" means.
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('speaks on the phone when the send to the device fails: silence is not an option', async () => {
    setAudioOutput('device');
    configureReader(deps({ sendAudio: () => Promise.resolve(false) }));
    enterSupermarket();

    await requestReading('device');

    // The sentence was already synthesized and nobody heard it. Paying twice beats leaving the user
    // with nothing, which is indistinguishable from a device that died.
    expect(mockSpeak).toHaveBeenCalled();
    expect(mockAudio.indexOf('end')).toBe(mockAudio.length - 1);
  });

  it('does not pay for a synthesis when the device cannot receive it', async () => {
    setAudioOutput('device');
    configureReader(deps({ isDeviceReady: () => false }));
    enterSupermarket();

    await requestReading('device');

    // Checked BEFORE synthesizing: the cloud TTS costs money and seconds, and the audio would have
    // nowhere to go.
    expect(mockSynthesize).not.toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('releases the session even when the photo never arrives', async () => {
    configureReader(deps({ downloadPhoto: () => Promise.reject(new Error('no route to host')) }));
    enterSupermarket();

    await requestReading('device');

    expect(mockAudio).toContain('end');
    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('no route to host'));
    expect(mockEvents).toContain('photo.failed');
  });

  it('releases the session even when the cloud throws', async () => {
    mockRecognize.mockRejectedValue(new Error('boom'));
    configureReader(deps());
    enterSupermarket();

    await requestReading('device');

    expect(mockAudio[mockAudio.length - 1]).toBe('end');
    expect(mockEvents).toContain('reading.failed');
  });

  it('reads the model at the instant of the reading, not when the deps were installed', async () => {
    let chosen: ModelProfile | null = null;
    configureReader(deps({ getModel: () => chosen }));
    enterSupermarket();

    // Nothing chosen yet: it says so instead of calling anybody.
    await requestReading('device');
    expect(mockRecognize).not.toHaveBeenCalled();

    chosen = MODEL;
    await requestReading('device');
    expect(mockRecognize).toHaveBeenCalledWith(expect.objectContaining({ model: MODEL }));
  });

  it('drops a second request while one is in flight instead of queueing a photo of a scene the user has left', async () => {
    let release: () => void = () => {};
    mockRecognize.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ms: 1, model: MODEL.id, product: null, text: '' });
        }),
    );
    configureReader(deps());
    enterSupermarket();

    const first = requestReading('device');
    await Promise.resolve();
    await Promise.resolve();
    await requestReading('device');
    release();
    await first;

    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it('does nothing at rest: idle captures nothing and announces nothing (ADR 0007)', async () => {
    configureReader(deps());

    await requestReading('device');

    expect(mockRecognize).not.toHaveBeenCalled();
    expect(mockAudio).toEqual([]);
  });

  it('gives up out loud when the cycle runs past the deadline instead of leaving silence', async () => {
    jest.useFakeTimers();
    mockRecognize.mockImplementation(
      (options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    configureReader(deps());
    enterSupermarket();

    const running = requestReading('device');
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(READING_DEADLINE_MS + 1);
    await running;

    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('Tardó demasiado'));
    expect(mockAudio[mockAudio.length - 1]).toBe('end');
    jest.useRealTimers();
  });
});

describe("the app's own button", () => {
  it('a double click names the mode AND asks for a reading, in one gesture (ADR 0007)', async () => {
    const written: string[] = [];
    configureReader(
      deps({
        writeMode: (mode) => {
          written.push(mode);
          return Promise.resolve();
        },
      }),
    );

    applyGesture('doubleClick');
    // The reading it starts is not awaited by the gesture: let it settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(getReaderState().mode).toBe('supermarket');
    // The device learns the mode over BLE; without this its AP and its own state drift from the app.
    expect(written).toEqual(['supermarket']);
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });
});
