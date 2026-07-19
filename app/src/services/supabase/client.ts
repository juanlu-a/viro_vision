/**
 * Supabase client for ViroVision's online account layer (auth, profile, sync, model-file hosting).
 * See ADR 0002 (docs/architecture/adr/0002-backend-and-auth-supabase.md).
 *
 * This module exposes the interface, the offline-safe stub, and the selector `getSupabaseAuthClient()`
 * which returns the real `@supabase/supabase-js`-backed client (authClient.ts + supabase.ts) when the
 * project is configured via `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
 * (see app/.env.example), and the stub otherwise — so the app always builds and runs with no backend.
 *
 * BOUNDARY RULE (ADR 0001 + 0002): this client must never be called from the camera → detection/OCR
 * → announcement path. It serves the account layer only, and must degrade gracefully offline.
 */
import type { AuthSession } from '@/features/auth/types';

import { createSupabaseAuthClient } from './authClient';
import { getSupabaseClient } from './supabase';

export interface SupabaseAuthClient {
  /** Restore a persisted session on startup (no network needed if a valid session is cached). */
  getSession(): Promise<AuthSession | null>;
  /** Sign in with email + password (requires internet). Resolves with the established session. */
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  /**
   * Create an account with email + password. Resolves with the session if one was created, or `null`
   * when email confirmation is required first (no session until the user confirms).
   */
  signUpWithEmail(email: string, password: string): Promise<AuthSession | null>;
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
  async signInWithEmail() {
    throw new SupabaseNotConfiguredError();
  },
  async signUpWithEmail() {
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
 * Returns the app's Supabase auth client: the real `@supabase/supabase-js`-backed client when the
 * project is configured (EXPO_PUBLIC_SUPABASE_* env vars present), otherwise the offline-safe stub.
 * This keeps the app runnable with no backend while enabling real email sign-in once configured.
 */
export function getSupabaseAuthClient(): SupabaseAuthClient {
  const supabase = getSupabaseClient();
  return supabase ? createSupabaseAuthClient(supabase) : stubClient;
}
