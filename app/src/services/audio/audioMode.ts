/**
 * The audio-session policy, on its own, with no native module behind it.
 *
 * It is split out from `session.ts` for the same reason `base64.ts` is split out from the BLE
 * client: the part that encodes a decision should be readable and testable without a device. Every
 * flag here is a decision, and the reasoning lives in `session.ts`'s docblock.
 */
import type { AudioMode } from 'expo-audio';

export const READING_AUDIO_MODE: Partial<AudioMode> = {
  /** The phone that lives in a pocket usually has the silent switch on. */
  playsInSilentMode: true,
  /**
   * NOT `duckOthers` and NOT `doNotMix` (which is what Expo's own background-playback example
   * uses): VoiceOver **is** this app's interface, and both of those talk over it.
   */
  interruptionMode: 'mixWithOthers',
  /** On iOS this is what keeps the session on `.playback` instead of `.playAndRecord`. */
  allowsRecording: false,
  /** The only reason a locked screen can speak at all. */
  shouldPlayInBackground: true,
};
