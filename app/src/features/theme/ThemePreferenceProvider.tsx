/**
 * Provides the theme preference (system / light / dark) to the whole app.
 *
 * The preference is read from storage at startup. While it is being read, `isReady` is false so the
 * root layout does not paint with one scheme first and jump to the other: a theme flash is annoying
 * for anyone and disorienting for someone with low vision.
 */
import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_THEME_PREFERENCE,
  loadThemePreference,
  saveThemePreference,
} from '@/services/storage/themePreference';
import type { ThemePreference } from '@/services/storage/themePreference';

export type ColorScheme = 'light' | 'dark';

interface ThemePreferenceValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** The effective scheme, already resolved against the system. */
  scheme: ColorScheme;
  setPreference: (preference: ThemePreference) => void;
  /** False until the stored preference has been read. */
  isReady: boolean;
}

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadThemePreference().then((stored) => {
      if (!active) return;
      setPreferenceState(stored);
      setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    // Applied immediately and persisted in the background: the UI's response does not wait for the
    // disk, and if the write fails the choice still holds for this session.
    setPreferenceState(next);
    void saveThemePreference(next);
  }, []);

  const value = useMemo<ThemePreferenceValue>(() => {
    const resolved: ColorScheme =
      preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;
    return { preference, scheme: resolved, setPreference, isReady };
  }, [preference, systemScheme, setPreference, isReady]);

  // NativeWind keeps its own scheme, and by default it follows the system's. If we do not push it,
  // the user picks "Claro" and everything using `dark:` stays dark — the theme selector would stop
  // working silently, only for the parts migrated to Tailwind. It is the price of having two styling
  // systems and it has to be paid in a single place: here.
  useEffect(() => {
    nativewindColorScheme.set(preference);
  }, [preference]);

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return value;
}
