/**
 * Persistencia de la preferencia de tema.
 *
 * Se guarda en AsyncStorage y no en Supabase a propósito: es una preferencia de accesibilidad y
 * tiene que sobrevivir sin red y sin cuenta. Alguien que necesita el tema claro para poder leer la
 * app no puede depender de que haya internet para que se respete.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** `system` sigue al sistema operativo; los otros dos lo fuerzan. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'virovision.themePreference';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Lee la preferencia guardada. Ante cualquier error devuelve el default en vez de romper. */
export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Guarda la preferencia. Un fallo de escritura no debe tumbar la app ni bloquear el cambio. */
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    /* la preferencia sigue aplicada en memoria durante esta sesión */
  }
}
