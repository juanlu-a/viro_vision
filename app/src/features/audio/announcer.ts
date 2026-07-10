/**
 * High-level auditory feedback: announces recognition events to the user by voice.
 * Bridges the recognition domain (what was detected) to the TTS service (how it's spoken).
 */
import { toAnnouncement } from '@/features/recognition/format';
import type { RecognitionEvent } from '@/features/recognition/types';
import { speak } from '@/services/audio/tts';

export function announceRecognition(event: RecognitionEvent, mentionOthers = false): void {
  speak(toAnnouncement(event, mentionOthers));
}

export function announce(text: string): void {
  speak(text);
}
