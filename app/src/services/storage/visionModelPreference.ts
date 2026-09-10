/**
 * Persistence of the cloud model chosen for supermarket mode (ADR 0006).
 *
 * It is stored in AsyncStorage and not in Supabase on purpose: it is mode configuration and it has to
 * survive without network and without an account (the app has no login). The model's **id** is
 * stored, not the whole profile: the model registry lives in the code and can change between
 * versions — the stored id is revalidated against the available ones in
 * `features/reader/productModel.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const VISION_MODEL_PREFERENCE_KEY = 'virovision.visionModel';

/** A plausible model id: a non-empty string. Real validity is decided by the resolver. */
export function isVisionModelId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Reads the stored id, or null when there is nothing (or storage fails): the resolver picks the default. */
export async function loadVisionModelPreference(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(VISION_MODEL_PREFERENCE_KEY);
    return isVisionModelId(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Stores the chosen id. A write failure must not take the app down nor block the change. */
export async function saveVisionModelPreference(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(VISION_MODEL_PREFERENCE_KEY, id);
  } catch {
    // The change is already applied in memory; without persistence, the next start returns to the default.
  }
}
