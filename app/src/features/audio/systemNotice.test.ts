/**
 * Exists because of the bug this module was written for: the setting said "the device" and the link,
 * the network, the mode and the chirp kept coming out of the phone. Nothing threw, nothing was
 * logged and every unit test passed — the only way to see it was to put the glasses on.
 *
 * So what is asserted here is the routing itself, for every shape a notice has:
 *
 *   1. a sentence with the output on the device goes to the board as a clip, and NOT to the phone
 *      as well: hearing it twice, from two places, is its own bug;
 *   2. a notice is a fixed sentence: no error text is ever appended (2026-10-06 — errors go to
 *      telemetry, never to the user's ear);
 *   3. every way the board path can fail ends with the phone speaking. Silence is the one outcome
 *      this app must never produce;
 *   4. the chirp is a sound and not a sentence, and still obeys the setting.
 */
import { resetAudioOutputForTests, setAudioOutput } from './audioOutput';
import { NOTICES } from './notices';
import { configureNotices, notify, resetNoticesForTests } from './systemNotice';

const spoken: string[] = [];
jest.mock('@/features/audio/announcer', () => ({
  announce: (text: string) => {
    spoken.push(text);
    return Promise.resolve();
  },
}));

const stops: string[] = [];
jest.mock('@/services/audio/tts', () => ({
  stopSpeaking: () => void stops.push('phone-stopped'),
}));

const chirps: string[] = [];
jest.mock('@/services/audio/session', () => ({
  playStartEarcon: () => void chirps.push('earcon'),
}));

const played: string[] = [];
const hushes: string[] = [];

/** A board that is there and plays whatever it is handed. */
function boardIsThere() {
  configureNotices({
    isLinked: () => true,
    playNotice: (clip: string) => {
      played.push(clip);
      return Promise.resolve();
    },
    hushDevice: () => {
      hushes.push('board-hushed');
      return Promise.resolve();
    },
  });
}

beforeEach(() => {
  spoken.length = 0;
  chirps.length = 0;
  played.length = 0;
  hushes.length = 0;
  stops.length = 0;
  resetAudioOutputForTests();
  resetNoticesForTests();
});

describe('notify', () => {
  it('sends a notice to the board, and only to the board, when that is the output', async () => {
    setAudioOutput('device');
    boardIsThere();

    await expect(notify('modeBus')).resolves.toBe('device');

    expect(played).toEqual([NOTICES.modeBus.clip]);
    // The half that is easy to forget: a notice said in both places at once is worse than one said
    // in the wrong place, because the user cannot tell it is the same event.
    expect(spoken).toEqual([]);
  });

  it('speaks on the phone when that is the output, even with the board right there', async () => {
    setAudioOutput('phone');
    boardIsThere();

    await expect(notify('modeBus')).resolves.toBe('phone');

    expect(spoken).toEqual([NOTICES.modeBus.say]);
    expect(played).toEqual([]);
  });

  it('says the network failure as its fixed sentence, on the phone whatever the setting says', async () => {
    // Link and network notices are the phone's since 2026-09-17 (see `notices.ts`), and since
    // 2026-10-06 they carry no detail: the IP or the system's error string would be an error shown
    // to the user, which is exactly what the app no longer does.
    setAudioOutput('device');
    boardIsThere();

    await expect(notify('networkFailed')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.networkFailed.say]);
    expect(played).toEqual([]);
  });

  it('writes nothing over BLE while the link is still being set up', async () => {
    // The regression of 2026-09-17, stated where it can be caught. `DeviceProvider` announces this
    // the instant the link comes up, one line before it reads the `wifi` characteristic to join the
    // board's AP. When the announcement was a BLE write, the two raced and the phone was left with
    // no credentials — the app reported it could not use the device's network, three layers away
    // from the cause. The connection notices reach the board through no path at all now.
    setAudioOutput('device');
    boardIsThere();

    for (const id of ['connected', 'connectionLost', 'networkReady', 'networkFailed'] as const) {
      await expect(notify(id)).resolves.toBe('phone');
    }
    expect(played).toEqual([]);
  });

  it('falls back to the phone with no link', async () => {
    setAudioOutput('device');
    configureNotices({ isLinked: () => false, playNotice: () => Promise.reject(new Error('no link')), hushDevice: () => Promise.resolve() });

    await expect(notify('modeBus')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.modeBus.say]);
  });

  it('falls back to the phone when the write fails after the link was checked', async () => {
    // The link died in the microseconds between the decision and the write. Rare, and the only
    // alternative is silence.
    setAudioOutput('device');
    configureNotices({ isLinked: () => true, playNotice: () => Promise.reject(new Error('gone')), hushDevice: () => Promise.resolve() });

    await expect(notify('modeBus')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.modeBus.say]);
  });

  it('falls back to the phone with no transport installed at all', async () => {
    // The state before `ReaderBridge` mounts, and the state of a build with no BLE module. It has to
    // be the safe answer, because it is the one in force while the app is starting up.
    setAudioOutput('device');
    await expect(notify('connected')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.connected.say]);
  });

  it('keeps the notices the board has no clip for on the phone', async () => {
    setAudioOutput('device');
    boardIsThere();

    await expect(notify('connectionLost')).resolves.toBe('phone');
    // The board cannot announce its own absence, and choosing the phone is confirmed by the phone.
    await expect(notify('outputSetToPhone')).resolves.toBe('phone');
    expect(played).toEqual([]);
    expect(spoken).toHaveLength(2);
  });

  it('routes the chirp too, and plays it as a sound rather than saying its name', async () => {
    setAudioOutput('phone');
    boardIsThere();
    await notify('readingStarted');
    expect(chirps).toEqual(['earcon']);
    expect(spoken).toEqual([]);

    setAudioOutput('device');
    await notify('readingStarted');
    expect(played).toEqual([NOTICES.readingStarted.clip]);
    // Still one: the board chirped, the phone did not.
    expect(chirps).toEqual(['earcon']);
  });

  it('silences the other output before speaking, in both directions', async () => {
    // Reported on 2026-09-18 testing on the board: with the output on the device, "Probar audio"
    // started playing through the speaker; after switching the setting to phone and tapping the
    // button again, the phone started the same phrase WITHOUT cutting the board's, and two voices
    // ended up overlapping.
    //
    // The cause was that each output only knew how to interrupt itself: the phone with
    // `Speech.stop()`, the board cutting its previous `aplay`. For someone who cannot see the
    // screen, two simultaneous voices are not information: they are noise. The rule is one voice at
    // a time, wherever it comes from.
    boardIsThere();

    setAudioOutput('device');
    await notify('audioTest');
    expect(stops).toEqual(['phone-stopped']);

    setAudioOutput('phone');
    await notify('audioTest');
    expect(hushes).toEqual(['board-hushed']);
  });

  it('does not reach for the board to hush it when there is no link', async () => {
    // Without a link there is nothing to hush, and asking would be a write that can only fail.
    setAudioOutput('phone');
    configureNotices({
      isLinked: () => false,
      playNotice: () => Promise.reject(new Error('no link')),
      hushDevice: () => {
        hushes.push('board-hushed');
        return Promise.resolve();
      },
    });

    await notify('connected');
    expect(hushes).toEqual([]);
  });

  it('never rejects, whatever the transport does', async () => {
    // It is called from BLE callbacks with nobody to catch it (ADR 0001).
    setAudioOutput('device');
    configureNotices({
      isLinked: () => {
        throw new Error('the client blew up');
      },
      playNotice: () => Promise.reject(new Error('gone')),
      hushDevice: () => Promise.resolve(),
    });
    await expect(notify('connected')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.connected.say]);
  });
});
