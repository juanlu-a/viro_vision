/**
 * Guards the three flags of the audio session.
 *
 * It looks like a test of a constant, and it is — the same kind as `constants/theme.test.ts`. Each
 * of these values is a decision that a well-meaning refactor would reverse without any visible
 * error, and the person who would find out is a blind user in a supermarket who suddenly hears
 * nothing, or whose screen reader gets talked over. There is no other place where that is written
 * down as an assertion.
 */
import { READING_AUDIO_MODE } from './audioMode';

describe('the reading audio session', () => {
  it('plays in silent mode: the phone that lives in a pocket usually has the switch on', () => {
    expect(READING_AUDIO_MODE.playsInSilentMode).toBe(true);
  });

  it('stays active in the background, which is the only reason the locked screen can speak', () => {
    expect(READING_AUDIO_MODE.shouldPlayInBackground).toBe(true);
  });

  it('mixes and never ducks: VoiceOver IS this app’s interface and must not be talked over', () => {
    // `duckOthers` lowers VoiceOver mid-sentence and `doNotMix` interrupts it outright. Expo's own
    // background-playback example uses `doNotMix`; this app deliberately does not.
    expect(READING_AUDIO_MODE.interruptionMode).toBe('mixWithOthers');
  });

  it('does not allow recording: on iOS that is what keeps the session on .playback', () => {
    // `.playAndRecord` routes to the receiver unless told otherwise and comes out quieter — the
    // opposite of what a phone in a pocket needs. It would also put a microphone permission in the
    // manifest that this app has no reason to ask for.
    expect(READING_AUDIO_MODE.allowsRecording).toBe(false);
  });
});
