/**
 * Exists because of the bug this module was written for: the setting said "the device" and the link,
 * the network, the mode and the chirp kept coming out of the phone. Nothing threw, nothing was
 * logged and every unit test passed — the only way to see it was to put the glasses on.
 *
 * So what is asserted here is the routing itself, for every shape a notice has:
 *
 *   1. a sentence with the output on the device goes to the board as a clip, and NOT to the phone
 *      as well: hearing it twice, from two places, is its own bug;
 *   2. the variable detail is appended on the phone and dropped on the board — a deliberate loss
 *      that has to stay deliberate, because nobody can record a clip per error message;
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

const chirps: string[] = [];
jest.mock('@/services/audio/session', () => ({
  playStartEarcon: () => void chirps.push('earcon'),
}));

const played: string[] = [];

/** A board that is there and plays whatever it is handed. */
function boardIsThere() {
  configureNotices({
    isLinked: () => true,
    playNotice: (clip: string) => {
      played.push(clip);
      return Promise.resolve();
    },
  });
}

beforeEach(() => {
  spoken.length = 0;
  chirps.length = 0;
  played.length = 0;
  resetAudioOutputForTests();
  resetNoticesForTests();
});

describe('notify', () => {
  it('sends a notice to the board, and only to the board, when that is the output', async () => {
    setAudioOutput('device');
    boardIsThere();

    await expect(notify('networkReady')).resolves.toBe('device');

    expect(played).toEqual([NOTICES.networkReady.clip]);
    // The half that is easy to forget: a notice said in both places at once is worse than one said
    // in the wrong place, because the user cannot tell it is the same event.
    expect(spoken).toEqual([]);
  });

  it('speaks on the phone when that is the output, even with the board right there', async () => {
    setAudioOutput('phone');
    boardIsThere();

    await expect(notify('networkReady')).resolves.toBe('phone');

    expect(spoken).toEqual([NOTICES.networkReady.say]);
    expect(played).toEqual([]);
  });

  it('appends the detail on the phone and drops it on the board', async () => {
    setAudioOutput('phone');
    boardIsThere();
    await notify('deviceWarning', 'camera timed out');
    expect(spoken).toEqual([`${NOTICES.deviceWarning.say} camera timed out`]);

    setAudioOutput('device');
    await notify('deviceWarning', 'camera timed out');
    // The clip is fixed, so the detail cannot travel. It is on screen and in telemetry, and the
    // sentence still names which thing complained — that trade is the design, not an accident.
    expect(played).toEqual([NOTICES.deviceWarning.clip]);
  });

  it('falls back to the phone with no link', async () => {
    setAudioOutput('device');
    configureNotices({ isLinked: () => false, playNotice: () => Promise.reject(new Error('no link')) });

    await expect(notify('modeBus')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.modeBus.say]);
  });

  it('falls back to the phone when the write fails after the link was checked', async () => {
    // The link died in the microseconds between the decision and the write. Rare, and the only
    // alternative is silence.
    setAudioOutput('device');
    configureNotices({ isLinked: () => true, playNotice: () => Promise.reject(new Error('gone')) });

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

  it('never rejects, whatever the transport does', async () => {
    // It is called from BLE callbacks with nobody to catch it (ADR 0001).
    setAudioOutput('device');
    configureNotices({
      isLinked: () => {
        throw new Error('the client blew up');
      },
      playNotice: () => Promise.reject(new Error('gone')),
    });
    await expect(notify('connected')).resolves.toBe('phone');
    expect(spoken).toEqual([NOTICES.connected.say]);
  });
});
