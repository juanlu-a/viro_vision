/**
 * Real SupabaseAuthClient using email + password (Supabase native auth). No OAuth / no Google.
 *
 * A signed-in session is persisted by AsyncStorage (configured in supabase.ts), so the user stays
 * signed in across restarts and while offline (ADR 0002). Tokens refresh silently when back online.
 *
 * NOTE: requires a configured Supabase project with Email auth enabled (see docs/supabase.md).
 */
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

    async signInWithEmail(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const session = toAuthSession(data.session);
      if (!session) throw new Error('No session returned after sign in');
      return session;
    },

    async signUpWithEmail(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // With email confirmation enabled, `data.session` is null until the user confirms.
      return toAuthSession(data.session);
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
