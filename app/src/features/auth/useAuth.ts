/**
 * Hook that owns the auth session state for the online account layer (ADR 0002).
 *
 * Offline behavior: on startup it restores a persisted session (no network needed); a signed-in user
 * stays signed in while offline. `signInWithGoogle` requires internet and, until Supabase is
 * configured, surfaces an honest "not configured yet" message instead of faking success. When the
 * real client lands, only services/supabase/client.ts changes — this hook and the UI stay the same.
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

function toState(session: AuthSession | null): AuthState {
  return session
    ? { status: 'signedIn', user: session.user, message: strings.auth.signedIn }
    : { status: 'signedOut', user: null, message: strings.auth.signedOut };
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

  const signInWithGoogle = useCallback(async () => {
    try {
      const session = await getSupabaseAuthClient().signInWithGoogle();
      setState(toState(session));
    } catch (err) {
      const message =
        err instanceof SupabaseNotConfiguredError
          ? strings.auth.notConfigured
          : strings.auth.error;
      setState({ status: 'error', user: null, message });
    }
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseAuthClient().signOut();
    setState(toState(null));
  }, []);

  return { state, signInWithGoogle, signOut };
}
