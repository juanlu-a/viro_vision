/**
 * Real SupabaseAuthClient using the OAuth web-redirect flow (Google).
 *
 * Flow: signInWithOAuth(skipBrowserRedirect) -> open the provider URL in an auth session browser ->
 * on redirect back to our deep link, exchange the returned code (PKCE) for a session. AsyncStorage
 * (configured in supabase.ts) then persists that session, so the user stays signed in offline.
 *
 * NOTE: requires a configured Supabase project with Google enabled and the app's redirect URL
 * allow-listed (see docs/supabase.md). The redirect round-trip can only be exercised end to end
 * against a real project.
 */
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import type { AuthSession } from '@/features/auth/types';
import type { SupabaseAuthClient } from './client';

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    user: {
      id: u.id,
      email: u.email ?? null,
      displayName: meta.full_name ?? meta.name ?? null,
      avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    },
    expiresAt: (session.expires_at ?? 0) * 1000,
  };
}

export function createSupabaseAuthClient(supabase: SupabaseClient): SupabaseAuthClient {
  return {
    async getSession() {
      const { data } = await supabase.auth.getSession();
      return toAuthSession(data.session);
    },

    async signInWithGoogle() {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Supabase did not return an OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        throw new Error('OAuth flow was cancelled');
      }

      const { params, errorCode } = QueryParams.getQueryParams(result.url);
      if (errorCode) throw new Error(errorCode);

      // PKCE flow returns a code to exchange; implicit flow returns tokens directly.
      if (params.code) {
        const { data: exchanged, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
        const session = toAuthSession(exchanged.session);
        if (!session) throw new Error('No session returned after code exchange');
        return session;
      }
      if (params.access_token) {
        const { data: set, error: setError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token ?? '',
        });
        if (setError) throw setError;
        const session = toAuthSession(set.session);
        if (!session) throw new Error('No session returned after setSession');
        return session;
      }
      throw new Error('OAuth redirect did not contain a session');
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    onAuthStateChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        listener(toAuthSession(session));
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
