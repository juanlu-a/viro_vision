/**
 * Hook that owns the auth session state for the online account layer (ADR 0002).
 *
 * Auth is Supabase email + password (no OAuth). Offline behavior: on startup it restores a persisted
 * session (no network needed); a signed-in user stays signed in while offline. Until Supabase is
 * configured, sign-in surfaces an honest "not configured yet" message instead of faking success. When
 * the backend is configured, only services/supabase changes — this hook and the UI stay the same.
 */
import { useCallback, useEffect, useState } from 'react';

import { strings } from '@/i18n';
import {
  getSupabaseAuthClient,
  SupabaseNotConfiguredError,
} from '@/services/supabase/client';
import type { AuthSession, AuthState } from './types';

const loadingState: AuthState = {
  status: 'loading',
  user: null,
  message: strings.auth.loading,
};

const signingInState: AuthState = {
  status: 'loading',
  user: null,
  message: strings.auth.signingIn,
};

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

export function useAuth() {
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
      const session = await getSupabaseAuthClient().signInWithEmail(email, password);
      setState(toState(session));
    } catch (err) {
      setState(errorState(err));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setState(signingInState);
    try {
      const session = await getSupabaseAuthClient().signUpWithEmail(email, password);
      // No session means email confirmation is required before the account is usable.
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

  return { state, signIn, signUp, signOut };
}
