/**
 * Persistence of the theme preference.
 *
 * It is stored in AsyncStorage and not in Supabase on purpose: it is an accessibility preference and
 * it has to survive without network and without an account. Someone who needs the light theme to be
 * able to read the app cannot depend on there being internet for it to be honoured.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** `system` follows the operating system; the other two force it. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'virovision.themePreference';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Reads the stored preference. On any error it returns the default instead of breaking. */
export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Stores the preference. A write failure must not take the app down nor block the change. */
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    /* the preference stays applied in memory for this session */
  }
}
