/**
 * Provee la preferencia de tema (sistema / claro / oscuro) a toda la app.
 *
 * La preferencia se lee del almacenamiento al arrancar. Mientras se lee, `isReady` es false para
 * que el layout raíz no pinte primero con un esquema y salte al otro: un flash de tema es molesto
 * para cualquiera y desorientador para alguien con baja visión.
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
  /** Lo que el usuario eligió. */
  preference: ThemePreference;
  /** El esquema efectivo, ya resuelto contra el sistema. */
  scheme: ColorScheme;
  setPreference: (preference: ThemePreference) => void;
  /** False hasta que se leyó la preferencia guardada. */
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
    // Se aplica de inmediato y se persiste en segundo plano: la respuesta de la UI no espera al
    // disco, y si la escritura falla la elección igual vale para esta sesión.
    setPreferenceState(next);
    void saveThemePreference(next);
  }, []);

  const value = useMemo<ThemePreferenceValue>(() => {
    const resolved: ColorScheme =
      preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;
    return { preference, scheme: resolved, setPreference, isReady };
  }, [preference, systemScheme, setPreference, isReady]);

  // NativeWind lleva su propio esquema, y por defecto sigue al del sistema. Si no se lo empujamos,
  // el usuario elige "Claro" y todo lo que use `dark:` se queda oscuro — el selector de tema
  // dejaría de funcionar en silencio, sólo para las partes migradas a Tailwind. Es el precio de
  // tener dos sistemas de estilos y hay que pagarlo en un solo lugar: acá.
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
    throw new Error('useThemePreference debe usarse dentro de ThemePreferenceProvider');
  }
  return value;
}
