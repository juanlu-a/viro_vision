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
  readFromDevice,
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

let mockOcrLoaded = true;
const mockLoadOcr = jest.fn((_onProgress?: (p: number) => void) => Promise.resolve({ ms: 0 }));
jest.mock('@/services/ondevice', () => ({
  isOcrLoaded: () => mockOcrLoaded,
  loadOcr: (onProgress?: (p: number) => void) => mockLoadOcr(onProgress),
  readImage: () => Promise.resolve({ ms: 1, detections: [] }),
}));

const mockEvents: string[] = [];
jest.mock('@/services/telemetry', () => ({
  ...jest.requireActual('@/services/telemetry/errorDetail'),
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
    hushDevice: () => Promise.resolve(),
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
  mockOcrLoaded = true;
  mockLoadOcr.mockClear();
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

  it('a bus reading is copied to the device only when the device is the chosen, reachable output', async () => {
    // With the output on the phone, the copy was a second voice saying the same line a moment
    // later; with the device unreachable, a cloud synthesis that had nowhere to go.
    const flushVoid = () => new Promise((r) => setImmediate(r));
    for (const [output, ready, expected] of [
      ['phone', true, 0],
      ['device', false, 0],
      ['device', true, 1],
    ] as const) {
      resetReaderForTests();
      setAudioOutput(output);
      configureReader(deps({ isDeviceReady: () => ready }));
      setModeFromDevice('bus');
      mockSynthesize.mockClear();

      await requestReading('device');
      await flushVoid();

      expect([output, ready, mockSynthesize.mock.calls.length]).toEqual([output, ready, expected]);
    }
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
    // Something is said — silence would leave the user waiting — but never the error's own text:
    // since 2026-10-06 that lives only in the telemetry row.
    expect(mockSpeak).toHaveBeenCalled();
    expect(mockSpeak).not.toHaveBeenCalledWith(expect.stringContaining('no route to host'));
    expect(mockEvents).toContain('photo.failed');
  });

  it('marks a failed capture as such, and clears it on the next reading and on a mode change', async () => {
    let fail = true;
    configureReader(
      deps({ downloadPhoto: () => (fail ? Promise.reject(new Error('no route to host')) : Promise.resolve(photo)) }),
    );
    enterSupermarket();

    await requestReading('device');
    expect(getReaderState().failure).toBe('deviceCapture');

    expect(getReaderState().resultPhrase).toBeNull();

    fail = false;
    await requestReading('device');
    expect(getReaderState().failure).toBeNull();
    expect(getReaderState().resultPhrase).toEqual(expect.stringContaining('Saman'));

    fail = true;
    await requestReading('device');
    setModeFromDevice('bus');
    expect(getReaderState().failure).toBeNull();
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
    // Until the cloud call is in flight: the deadline is about IT, not about the photo.
    for (let i = 0; i < 20 && mockRecognize.mock.calls.length === 0; i += 1) await Promise.resolve();
    expect(mockRecognize).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(READING_DEADLINE_MS + 1);
    await running;

    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('Tardó demasiado'));
    expect(mockAudio[mockAudio.length - 1]).toBe('end');
    jest.useRealTimers();
  });
});

/**
 * The bug of 2026-09-13: the double click turned supermarket on and took no photo, and only the NEXT
 * double click read anything.
 *
 * The cause was an ordering one, not a timing one, so it reproduces deterministically here: the
 * board's `read` event reaches the pipeline synchronously while the mode it announces has to travel
 * through React state first. These tests pin the contract that fixes it — a reading from the board
 * is judged against the mode the BOARD reports, never against the mode the app has caught up to.
 *
 * They are worth keeping past the fix because the failure is invisible: nothing throws, nothing is
 * logged, the mode is announced correctly, and the only symptom is a photo that is never taken.
 */
describe('a reading asked for by the physical button', () => {
  it('reads in the mode the board reports, even when the app still thinks it is idle', async () => {
    configureReader(deps());
    // No `enterSupermarket()` on purpose: this is the state the app is in when the FIRST double
    // click arrives — idle, because the mode notification has not been committed yet.
    expect(getReaderState().mode).toBe('idle');

    await readFromDevice('supermarket');

    expect(getReaderState().mode).toBe('supermarket');
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it('does not read in the previous mode when the double click also changed it', async () => {
    configureReader(deps());
    setModeFromDevice('bus');
    mockRecognize.mockClear();

    await readFromDevice('supermarket');

    // Bus and supermarket are different pipelines (ADR 0006): running the reading a tick early sent
    // the shelf photo through the OCR meant for a bus sign, which looks to the user exactly like
    // "it did nothing".
    expect(getReaderState().mode).toBe('supermarket');
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it('repeats the reading when the board reports the mode it is already in (ADR 0007)', async () => {
    configureReader(deps());
    setModeFromDevice('supermarket');

    await readFromDevice('supermarket');
    await readFromDevice('supermarket');

    // In front of the shelf the user double-clicks once per product: the second gesture changes no
    // mode and still has to take a photo.
    expect(mockRecognize).toHaveBeenCalledTimes(2);
  });

  it('falls back to the app\'s own mode for a board too old to send one', async () => {
    configureReader(deps());
    enterSupermarket();

    await readFromDevice(null);

    expect(mockRecognize).toHaveBeenCalledTimes(1);
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

/**
 * The overlap reported on 2026-11-20: a supermarket reading still in flight when the user switched to
 * bus kept going, and its result (or "elemento no reconocible", or an error) was said on top of
 * "modo ómnibus activado" and the bus lines. A mode change now cancels the reading and silences it.
 */
describe('a mode change during a reading', () => {
  function pendingRecognition() {
    let settle: (value: unknown) => void = () => {};
    let aborted: AbortSignal | undefined;
    mockRecognize.mockImplementation(
      (options: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          aborted = options.signal;
          settle = resolve;
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    return {
      resolve: () => settle({ ms: 1, model: MODEL.id, product: null, text: '' }),
      signal: () => aborted,
    };
  }

  async function untilRecognizing() {
    for (let i = 0; i < 10 && mockRecognize.mock.calls.length === 0; i += 1) await Promise.resolve();
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  }

  it('cancels the cloud call and says nothing of the old mode, not even the timeout', async () => {
    const hush = jest.fn(() => Promise.resolve());
    const cloud = pendingRecognition();
    configureReader(deps({ hushDevice: hush }));
    enterSupermarket();

    const running = requestReading('device');
    await untilRecognizing();
    setModeFromDevice('bus');
    await running;

    expect(cloud.signal()?.aborted).toBe(true);
    expect(hush).toHaveBeenCalled();
    const said = mockSpeak.mock.calls.map(([text]) => text);
    expect(said.some((text) => /no reconoc|Tardó demasiado|no pudo/i.test(text))).toBe(false);
    expect(mockEvents).toContain('reading.cancelled');
    expect(mockAudio[mockAudio.length - 1]).toBe('end');
  });

  it('does not send a late result to the device after the user left supermarket', async () => {
    let finishSynthesis: (uri: string) => void = () => {};
    mockSynthesize.mockImplementationOnce(() => new Promise((resolve) => (finishSynthesis = resolve)));
    const sendAudio = jest.fn(() => Promise.resolve(true));
    setAudioOutput('device');
    configureReader(deps({ sendAudio }));
    enterSupermarket();

    const running = requestReading('device');
    for (let i = 0; i < 20 && mockSynthesize.mock.calls.length === 0; i += 1) await Promise.resolve();
    expect(mockSynthesize).toHaveBeenCalledTimes(1);
    setModeFromDevice('bus');
    finishSynthesis('file:///tmp/late.mp3');
    await running;

    expect(sendAudio).not.toHaveBeenCalled();
    // And no phone fallback either: the reading belongs to a mode the user already left.
    expect(mockSpeak.mock.calls.some(([text]) => /arroz/i.test(text))).toBe(false);
  });

  it('lets the new mode read right away instead of dropping it as "already reading"', async () => {
    const cloud = pendingRecognition();
    configureReader(deps());
    enterSupermarket();

    const first = requestReading('device');
    await untilRecognizing();
    setModeFromDevice('bus');
    setModeFromDevice('supermarket');
    mockRecognize.mockReset();
    mockRecognize.mockResolvedValue({ ms: 1, model: MODEL.id, product: { kind: 'yerba', brand: null, detail: null }, text: '' });
    await requestReading('device');
    cloud.resolve();
    await first;

    expect(mockRecognize).toHaveBeenCalledTimes(1);
    expect(mockSpeak.mock.calls.some(([text]) => /yerba/i.test(text))).toBe(true);
  });
});

describe('a mode change while the bus OCR model is still loading', () => {
  it('does not leave the new mode marked as reading when the load finishes', async () => {
    let finishLoad: (r: { ms: number }) => void = () => {};
    let progress: ((p: number) => void) | undefined;
    mockOcrLoaded = false;
    mockLoadOcr.mockImplementationOnce((onProgress) => {
      progress = onProgress;
      return new Promise((resolve) => (finishLoad = resolve));
    });
    configureReader(deps());
    setModeFromDevice('bus');

    const running = requestReading('device');
    for (let i = 0; i < 20 && mockLoadOcr.mock.calls.length === 0; i += 1) await Promise.resolve();
    expect(mockLoadOcr).toHaveBeenCalledTimes(1);
    setModeFromDevice('supermarket');
    const afterChange = getReaderState().status;
    progress?.(0.5);
    finishLoad({ ms: 1 });
    await running;

    expect(getReaderState().status).toBe(afterChange);
    expect(getReaderState().status).not.toBe('reading');
    expect(getReaderState().progress ?? null).toBeNull();
  });
});

/**
 * The camera error of 2026-11-20 on the first use after connecting: the photo was asked for while
 * the phone was still joining the device's AP, while the board's camera was still starting (503),
 * or in the same instant the mode left bus and the frame loop still held the camera.
 */
describe('the first reading after connecting', () => {
  const { HttpDownloadError } = jest.requireActual('@/services/wifi/deviceHttp');

  afterEach(() => jest.useRealTimers());

  it('waits for the phone to join the device network instead of failing at once', async () => {
    jest.useFakeTimers();
    let onNetwork = false;
    const downloadPhoto = jest.fn(() => Promise.resolve(photo));
    const joinDeviceNetwork = jest.fn(() => Promise.resolve(true));
    configureReader(deps({ isNetworkReady: () => onNetwork, downloadPhoto, joinDeviceNetwork }));
    enterSupermarket();

    const running = requestReading('device');
    await jest.advanceTimersByTimeAsync(3_000);
    expect(downloadPhoto).not.toHaveBeenCalled();
    // The reading needs the photo, so now the system is asked (the prompt is worth it here, unlike
    // on every connection).
    expect(joinDeviceNetwork).toHaveBeenCalledTimes(1);
    onNetwork = true;
    await jest.advanceTimersByTimeAsync(500);
    await running;

    expect(downloadPhoto).toHaveBeenCalledTimes(1);
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it('says the device is still connecting when the network never comes', async () => {
    jest.useFakeTimers();
    const downloadPhoto = jest.fn(() => Promise.resolve(photo));
    configureReader(deps({ isNetworkReady: () => false, downloadPhoto }));
    enterSupermarket();

    const running = requestReading('device');
    await jest.advanceTimersByTimeAsync(21_000);
    await running;

    expect(downloadPhoto).not.toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('todavía se está conectando'));
    expect(mockAudio[mockAudio.length - 1]).toBe('end');
  });

  it('retries while the camera is starting (503) and reads once it answers', async () => {
    jest.useFakeTimers();
    const downloadPhoto = jest
      .fn()
      .mockRejectedValueOnce(new HttpDownloadError('the device has no camera', 503))
      .mockRejectedValueOnce(new HttpDownloadError('the device has no camera', 503))
      .mockResolvedValue(photo);
    configureReader(deps({ downloadPhoto }));
    enterSupermarket();

    const running = requestReading('device');
    await jest.advanceTimersByTimeAsync(3_000);
    await running;

    expect(downloadPhoto).toHaveBeenCalledTimes(3);
    expect(mockRecognize).toHaveBeenCalledTimes(1);
  });

  it('says the camera is starting, not that it failed, when the 503 outlasts the wait', async () => {
    jest.useFakeTimers();
    const downloadPhoto = jest.fn(() => Promise.reject(new HttpDownloadError('the device has no camera', 503)));
    configureReader(deps({ downloadPhoto }));
    enterSupermarket();

    const running = requestReading('device');
    await jest.advanceTimersByTimeAsync(10_000);
    await running;

    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('se está iniciando'));
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it('asks for the photo only once the board has the new mode', async () => {
    const order: string[] = [];
    let ack: () => void = () => {};
    configureReader(
      deps({
        writeMode: () =>
          new Promise<void>((resolve) => {
            ack = () => {
              order.push('mode');
              resolve();
            };
          }),
        downloadPhoto: () => {
          order.push('photo');
          return Promise.resolve(photo);
        },
      }),
    );

    applyGesture('doubleClick');
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(order).toEqual([]);
    ack();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(order).toEqual(['mode', 'photo']);
  });
});

describe('review follow-ups', () => {
  it('ignores the board reporting the previous mode while the app is still writing the new one', async () => {
    let ack: () => void = () => {};
    configureReader(deps({ writeMode: () => new Promise<void>((resolve) => (ack = resolve)) }));
    applyGesture('click'); // → bus, write pending

    setModeFromDevice('idle'); // the board's echo of the mode BEFORE the click

    expect(getReaderState().mode).toBe('bus');
    ack();
  });

  it('still applies a real button press on the board while the app is writing its mode', () => {
    configureReader(deps({ writeMode: () => new Promise<void>(() => {}) }));
    applyGesture('click'); // idle → bus, write pending

    setModeFromDevice('supermarket'); // not the echo of idle: the user pressed the board's button

    expect(getReaderState().mode).toBe('supermarket');
  });

  it('stops filtering echoes when the mode write never answers', async () => {
    jest.useFakeTimers();
    configureReader(deps({ writeMode: () => new Promise<void>(() => {}) }));
    applyGesture('click'); // idle → bus, the write hangs

    await jest.advanceTimersByTimeAsync(2_000);
    setModeFromDevice('idle');

    expect(getReaderState().mode).toBe('idle');
    jest.useRealTimers();
  });

  it('says "conectando" once while it waits for the network, and not before 3 s', async () => {
    jest.useFakeTimers();
    let onNetwork = false;
    configureReader(deps({ isNetworkReady: () => onNetwork }));
    enterSupermarket();

    const running = requestReading('device');
    await jest.advanceTimersByTimeAsync(2_000);
    expect(mockSpeak.mock.calls.filter(([text]) => /Conectando/.test(text))).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(6_000);
    onNetwork = true;
    await jest.advanceTimersByTimeAsync(500);
    await running;

    expect(mockSpeak.mock.calls.filter(([text]) => /Conectando/.test(text))).toHaveLength(1);
    jest.useRealTimers();
  });

  it('says the photo is for the reading mode, so the board can wait for bus mode to let go', async () => {
    const downloadPhoto = jest.fn(() => Promise.resolve(photo));
    configureReader(deps({ downloadPhoto }));
    enterSupermarket();

    await requestReading('device');

    expect(downloadPhoto).toHaveBeenCalledWith(expect.objectContaining({ mode: 'supermarket' }));
  });
});

describe('the total budget of a cycle', () => {
  const { HttpDownloadError } = jest.requireActual('@/services/wifi/deviceHttp');

  afterEach(() => jest.useRealTimers());

  it('shrinks the photo timeout and the cloud deadline after a long network wait', async () => {
    jest.useFakeTimers();
    let onNetwork = false;
    const timeouts: number[] = [];
    let attempts = 0;
    const downloadPhoto = jest.fn((options?: { timeoutMs?: number }) => {
      timeouts.push(options?.timeoutMs ?? -1);
      attempts += 1;
      return attempts < 6 ? Promise.reject(new HttpDownloadError('the device has no camera', 503)) : Promise.resolve(photo);
    });
    let cloudSignal: AbortSignal | undefined;
    mockRecognize.mockImplementation(
      (options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          cloudSignal = options.signal;
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    configureReader(deps({ isNetworkReady: () => onNetwork, downloadPhoto }));
    enterSupermarket();

    const running = requestReading('device');
    await jest.advanceTimersByTimeAsync(19_000);
    onNetwork = true;
    await jest.advanceTimersByTimeAsync(5_500); // five 503s (camera starting), then the photo
    expect(downloadPhoto).toHaveBeenCalledTimes(6);
    // The budget runs out under the retries: the late attempts get less than the usual 7 s.
    expect(timeouts[0]).toBe(7_000);
    expect(timeouts[5]).toBeLessThan(7_000);
    expect(cloudSignal?.aborted).toBe(false);

    // Well under 12 s after the photo, but at the 30 s mark since the press.
    await jest.advanceTimersByTimeAsync(6_000);
    await running;

    expect(cloudSignal?.aborted).toBe(true);
    expect(mockSpeak).toHaveBeenCalledWith(expect.stringContaining('Tardó demasiado'));
  });
});
