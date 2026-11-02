/**
 * The app mode for every screen: product (clean) or development.
 *
 * A Provider and not a hook per screen for the same reason as the model: the switch lives in
 * Settings and what it hides lives on Home, and two `useState`s would leave Home on the old value
 * until a remount. It only decides what the SCREEN shows: telemetry, the evidence upload and the
 * reading pipeline never read it, so product mode loses no data in Supabase.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_APP_MODE,
  loadAppModePreference,
  saveAppModePreference,
  type AppMode,
} from '@/services/storage/appModePreference';

interface AppModeValue {
  mode: AppMode;
  isDevelopment: boolean;
  setMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeValue | null>(null);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  // Product until the stored value arrives: if the team's phone flashes clean for a frame that is
  // harmless; a user's phone flashing the photos would not be.
  const [mode, setState] = useState<AppMode>(DEFAULT_APP_MODE);
  // A choice made before the stored value arrives wins: otherwise the late load would put the old
  // mode back on screen while storage already holds the new one.
  const chosen = useRef(false);

  useEffect(() => {
    let alive = true;
    void loadAppModePreference().then((stored) => {
      if (alive && !chosen.current) setState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((next: AppMode) => {
    chosen.current = true;
    setState(next);
    void saveAppModePreference(next);
  }, []);

  const value = useMemo<AppModeValue>(
    () => ({ mode, isDevelopment: mode === 'development', setMode }),
    [mode, setMode],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeValue {
  const value = useContext(AppModeContext);
  if (!value) throw new Error('useAppMode must be used within an AppModeProvider');
  return value;
}
