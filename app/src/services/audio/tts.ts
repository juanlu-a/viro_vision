/**
 * Text-to-speech output for ViroVision.
 *
 * This is the phone's side of the app's auditory-feedback channel: it speaks via `expo-speech`
 * (the OS TTS engine). Choosing where the audio is heard is not done here: the user's output
 * setting and the delivery rules live in `features/audio/audioOutput.ts`, and
 * `features/audio/systemNotice.ts` routes each notice either to this phone speech or to the
 * device's speaker.
 */
import * as Speech from 'expo-speech';

export interface SpeakOptions {
  /** BCP-47 language tag; defaults to Uruguayan Spanish. */
  language?: string;
  /** Interrupt any current utterance before speaking. */
  interrupt?: boolean;
}

/**
 * Speaks, and resolves when the utterance is actually over.
 *
 * The promise is what lets a caller hold the audio session open until the last word (see
 * `services/audio/session.ts`): releasing it on the line after `speak()` cuts the announcement in
 * half with the screen locked. It **never rejects** — a failure to speak resolves like an end,
 * because the only caller is the announcement path and ADR 0001 forbids anything there from
 * throwing. Every existing caller ignores the promise and keeps working exactly as before.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const { language = 'es-UY', interrupt = true } = options;
  if (interrupt) Speech.stop();
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      Speech.speak(text, { language, onDone: done, onStopped: done, onError: done });
    } catch {
      done();
    }
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}

// Output routing (phone vs. device speaker) is decided by `features/audio/audioOutput.ts` and
// `features/audio/systemNotice.ts`; this module only speaks on the phone.
