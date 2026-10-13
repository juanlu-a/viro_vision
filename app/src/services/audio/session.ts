/**
 * The audio session of a reading.
 *
 * **Why this file exists.** Until 2026-09-10 the app never configured an audio session at all. iOS
 * then leaves it on the default category, which is not allowed to make any sound with the screen
 * locked — and "the phone stays locked in the user's pocket" is not a nice-to-have here, it is the
 * whole product (ADR 0003 §2). An announcement nobody can hear is the same as no announcement.
 *
 * **Why `mixWithOthers` and not `duckOthers`.** VoiceOver *is* the interface for this user.
 * `duckOthers` lowers VoiceOver mid-sentence and `doNotMix` interrupts it outright; either one turns
 * a product reading into "the screen reader went quiet and I do not know why". Mixing costs us
 * nothing: our announcement is short and the user asked for it.
 *
 * **Why `allowsRecording: false`.** On iOS it is what maps the session to `.playback` instead of
 * `.playAndRecord`; the recording category routes to the receiver unless told otherwise and comes
 * out quieter — the opposite of what a phone in a pocket needs.
 *
 * **Why a keep-alive sound.** iOS grants only a few seconds of execution when it wakes the app for a
 * BLE notification. The measured cycle is ~3 s (ADR 0003), but the tail is not: the cloud can queue,
 * the quota limiter can wait, the AP can be slow on the first request. Audio that is actually
 * playing is what keeps the process alive under the `audio` background mode, so a reading holds an
 * inaudible tone from the moment it starts until the announcement has finished. It costs a few
 * seconds of a −50 dBFS 40 Hz tone per reading. It is deliberately a real signal and not digital
 * silence: an all-zero file is the old trick and it is the one an OS is most likely to stop honouring.
 *
 * **Nothing here throws.** Same rule as telemetry, for a stronger reason: this sits on the
 * announcement path, and ADR 0001 says nothing may cost the user their audio. Every call is wrapped
 * and reports its outcome as a boolean instead.
 */
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';

// The policy lives next door, free of the native module, so it can be asserted without a device.
import { READING_AUDIO_MODE } from './audioMode';

export { READING_AUDIO_MODE };

let keepAlive: AudioPlayer | null = null;
let earcon: AudioPlayer | null = null;
let holders = 0;

/**
 * Sets the category once, at startup. It does **not** activate the session: `setAudioModeAsync`
 * configures, `setIsAudioActiveAsync` activates, and activating with nothing to play would hold the
 * route open for no reason.
 */
export async function configureAudioSession(): Promise<boolean> {
  try {
    await setAudioModeAsync(READING_AUDIO_MODE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the session for a reading and starts the keep-alive. Call it **before the first `await`** of
 * the reading: after one, iOS may already have taken the execution slot back.
 *
 * Re-entrant by counting: a second reading that overlaps must not tear down the first one's session.
 */
export async function beginReadingAudio(): Promise<boolean> {
  holders += 1;
  try {
    await setAudioModeAsync(READING_AUDIO_MODE);
    await setIsAudioActiveAsync(true);
    if (!keepAlive) {
      keepAlive = createAudioPlayer(require('@/assets/audio/keepalive.m4a'));
      keepAlive.loop = true;
      keepAlive.volume = 1;
    }
    keepAlive.play();
    return true;
  } catch {
    return false;
  }
}

/** Closes what `beginReadingAudio` opened. Safe to call twice; safe to call when begin failed. */
export async function endReadingAudio(): Promise<void> {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  try {
    keepAlive?.pause();
    // The session is released so the app stops holding the audio route between readings. Nothing
    // else in the app plays audio, and a session held open is a session that shows up in the user's
    // battery report as ours.
    await setIsAudioActiveAsync(false);
  } catch {
    // Rule: the audio path never throws.
  }
}

/**
 * A short chirp, played the instant a reading is requested.
 *
 * It is feedback the user did not have —today the button does nothing audible for the ~1,5 s the
 * cloud takes— and it doubles as the best diagnostic we can ship: with the screen locked, either the
 * chirp is heard immediately (the app woke up and the audio session works, so anything that fails
 * afterwards is the pipeline) or it is not (the app was never woken). No console can tell us that.
 */
export function playStartEarcon(): void {
  try {
    if (!earcon) earcon = createAudioPlayer(require('@/assets/audio/earcon-start.m4a'));
    // Rewinding is asynchronous and the chirp must not wait for it: playing from wherever it is is
    // better than a silent button.
    void earcon.seekTo(0).catch(() => {});
    earcon.play();
  } catch {
    // Never at the cost of the reading.
  }
}

/** Tests only. */
export function resetAudioSessionForTests(): void {
  keepAlive = null;
  earcon = null;
  holders = 0;
}
