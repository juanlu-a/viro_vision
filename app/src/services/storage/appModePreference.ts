/**
 * Persistence of the app mode: product (the clean interface people use) or development (the team's,
 * with the photos and the model selector).
 *
 * In AsyncStorage, like the model: it is a per-phone setting and has to survive without network.
 * Anything that is not exactly 'development' reads as 'product', so a missing, old or corrupt value
 * always lands on the clean side — a tester must never find the debug screens by accident.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppMode = 'product' | 'development';

export const DEFAULT_APP_MODE: AppMode = 'product';

export const APP_MODE_PREFERENCE_KEY = 'virovision.appMode';

export function parseAppMode(value: unknown): AppMode {
  return value === 'development' ? 'development' : DEFAULT_APP_MODE;
}

export async function loadAppModePreference(): Promise<AppMode> {
  try {
    return parseAppMode(await AsyncStorage.getItem(APP_MODE_PREFERENCE_KEY));
  } catch {
    return DEFAULT_APP_MODE;
  }
}

/** A write failure must not block the change: it is already applied in memory. */
export async function saveAppModePreference(mode: AppMode): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_MODE_PREFERENCE_KEY, mode);
  } catch {
    // Without persistence the next start returns to product mode, which is the safe side.
  }
}
