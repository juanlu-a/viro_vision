/**
 * Text-to-speech output for ViroVision.
 *
 * This is the app's auditory-feedback channel. Speaking via `expo-speech` works today (uses the
 * OS TTS engine). What is NOT done yet is ROUTING this audio to the device's dedicated earphone:
 * per the thesis, ViroVision's recognition audio should play on the device earphone while the rest
 * of the phone's audio (calls, notifications, the OS screen reader) keeps its normal output. That
 * requires platform audio-session/routing APIs (AVAudioSession on iOS, AudioManager/AudioDeviceInfo
 * on Android) or an output-device-selection library — tracked as a follow-up task.
 */
import * as Speech from 'expo-speech';

export interface SpeakOptions {
  /** BCP-47 language tag; defaults to Uruguayan Spanish. */
  language?: string;
  /** Interrupt any current utterance before speaking. */
  interrupt?: boolean;
}

export function speak(text: string, options: SpeakOptions = {}): void {
  const { language = 'es-UY', interrupt = true } = options;
  if (interrupt) Speech.stop();
  Speech.speak(text, { language });
}

export function stopSpeaking(): void {
  Speech.stop();
}

// TODO(audio-routing): route this output specifically to the ViroVision device earphone
// (separate audio channel) instead of the system default output. See services/audio/README.
