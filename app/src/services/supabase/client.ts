/**
 * Supabase client for ViroVision's online account layer (auth, profile, sync, model-file hosting).
 * See ADR 0002 (docs/architecture/adr/0002-backend-and-auth-supabase.md).
 *
 * STATUS: interface + honest stub. The real implementation wraps `@supabase/supabase-js`, configured
 * with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see app/.env.example) and a
 * secure-storage session adapter (e.g. expo-secure-store) with `persistSession: true` and
 * `autoRefreshToken: true`. It is intentionally NOT wired yet, so the app builds and runs with no
 * backend and no network dependency.
 *
 * BOUNDARY RULE (ADR 0001 + 0002): this client must never be called from the camera → detection/OCR
 * → announcement path. It serves the account layer only, and must degrade gracefully offline.
 */
import type { AuthSession } from '@/features/auth/types';

export interface SupabaseAuthClient {
  /** Restore a persisted session on startup (no network needed if a valid session is cached). */
  getSession(): Promise<AuthSession | null>;
  /** Start Google OAuth (requires internet). Resolves once a session is established. */
  signInWithGoogle(): Promise<AuthSession>;
  /** Explicit sign-out. Clears the persisted session. */
  signOut(): Promise<void>;
  /** Subscribe to session changes (sign-in, sign-out, silent refresh). Returns an unsubscribe fn. */
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
}

/** Thrown by the stub until the real Supabase client is implemented. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('SUPABASE_NOT_CONFIGURED');
    this.name = 'SupabaseNotConfiguredError';
  }
}

const stubClient: SupabaseAuthClient = {
  async getSession() {
    // No backend yet: behave as a signed-out, offline-safe app.
    return null;
  },
  async signInWithGoogle() {
    throw new SupabaseNotConfiguredError();
  },
  async signOut() {
    /* no-op: nothing persisted in the stub */
  },
  onAuthStateChange() {
    return () => {};
  },
};

/**
 * Returns the app's Supabase auth client. Swap `stubClient` for the real
 * `@supabase/supabase-js`-backed implementation once the project + env vars exist.
 */
export function getSupabaseAuthClient(): SupabaseAuthClient {
  return stubClient;
}
