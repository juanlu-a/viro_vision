/**
 * High-level auditory feedback: announces recognition events to the user by voice.
 * Bridges the recognition domain (what was detected) to the TTS service (how it's spoken).
 */
import { toAnnouncement } from '@/features/recognition/format';
import type { RecognitionEvent } from '@/features/recognition/types';
import { speak } from '@/services/audio/tts';

export function announceRecognition(event: RecognitionEvent, mentionOthers = false): Promise<void> {
  return speak(toAnnouncement(event, mentionOthers));
}

/**
 * Says something out loud. The returned promise resolves when the voice has finished; callers that
 * do not care may ignore it, and most do. The reading pipeline does care: with the screen locked it
 * has to keep the audio session open until the last word (`services/audio/session.ts`).
 */
export function announce(text: string): Promise<void> {
  return speak(text);
}
