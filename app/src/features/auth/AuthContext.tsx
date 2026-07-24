/**
 * Shared auth state for the online account layer (ADR 0002), exposed via context so the auth gate
 * (navigation) and screens read one session — not independent copies.
 *
 * Auth is Supabase email + password (no OAuth). On startup it restores a persisted session (no network
 * needed); a signed-in user stays signed in offline. Until Supabase is configured, sign-in surfaces an
 * honest "not configured yet" message instead of faking success.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { strings } from '@/i18n';
import {
  getSupabaseAuthClient,
  SupabaseNotConfiguredError,
} from '@/services/supabase/client';
import type { AuthSession, AuthState } from './types';

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const loadingState: AuthState = { status: 'loading', user: null, message: strings.auth.loading };
const signingInState: AuthState = { status: 'loading', user: null, message: strings.auth.signingIn };

function toState(session: AuthSession | null): AuthState {
  return session
    ? { status: 'signedIn', user: session.user, message: strings.auth.signedIn }
    : { status: 'signedOut', user: null, message: strings.auth.signedOut };
}

function errorState(err: unknown): AuthState {
  const message =
    err instanceof SupabaseNotConfiguredError ? strings.auth.notConfigured : strings.auth.error;
  return { status: 'error', user: null, message };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(loadingState);

  useEffect(() => {
    const client = getSupabaseAuthClient();
    let active = true;
    client.getSession().then((session) => {
      if (active) setState(toState(session));
    });
    const unsubscribe = client.onAuthStateChange((session) => {
      if (active) setState(toState(session));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(signingInState);
    try {
      setState(toState(await getSupabaseAuthClient().signInWithEmail(email, password)));
    } catch (err) {
      setState(errorState(err));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState(signingInState);
    try {
      const session = await getSupabaseAuthClient().signUpWithEmail(email, password);
      setState(
        session
          ? toState(session)
          : { status: 'signedOut', user: null, message: strings.auth.confirmEmail },
      );
    } catch (err) {
      setState(errorState(err));
    }
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseAuthClient().signOut();
    setState(toState(null));
  }, []);

  const value = useMemo(() => ({ state, signIn, signUp, signOut }), [state, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
