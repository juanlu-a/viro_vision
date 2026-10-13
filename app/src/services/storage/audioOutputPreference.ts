/**
 * Persistence of where a supermarket reading is heard: the phone or the device's speaker.
 *
 * In AsyncStorage and not in Supabase, for the same reason as the model preference: it is mode
 * configuration and it has to survive without network and without an account (the app has no login).
 * A setting that needed the backend to answer would contradict ADR 0001.
 *
 * The type and the decision live in `features/audio/audioOutput.ts` and this only stores them — the
 * same direction `services/ble/bleClient.ts` already takes with the GATT types. Keeping the policy
 * out of here is what lets it be tested without a native module.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_AUDIO_OUTPUT, isAudioOutput, type AudioOutput } from '@/features/audio/audioOutput';

export const AUDIO_OUTPUT_PREFERENCE_KEY = 'virovision.audioOutput';

/** The stored choice, or the default when there is nothing (or storage fails). */
export async function loadAudioOutputPreference(): Promise<AudioOutput> {
  try {
    const stored = await AsyncStorage.getItem(AUDIO_OUTPUT_PREFERENCE_KEY);
    return isAudioOutput(stored) ? stored : DEFAULT_AUDIO_OUTPUT;
  } catch {
    return DEFAULT_AUDIO_OUTPUT;
  }
}

/** Stores the choice. A write failure must not block the change: it is already applied in memory. */
export async function saveAudioOutputPreference(value: AudioOutput): Promise<void> {
  try {
    await AsyncStorage.setItem(AUDIO_OUTPUT_PREFERENCE_KEY, value);
  } catch {
    // Without persistence the next start goes back to the default; the session keeps the choice.
  }
}
