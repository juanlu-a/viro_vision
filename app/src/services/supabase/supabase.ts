/**
 * Creates and memoizes the Supabase JS client for React Native.
 *
 * - AsyncStorage persists the session locally, so a signed-in user stays signed in across restarts
 *   and while offline (ADR 0002). Tokens auto-refresh when back online.
 * - `detectSessionInUrl: false` because there is no browser URL bar in RN; the OAuth redirect is
 *   handled explicitly in authClient.ts (exchangeCodeForSession / setSession).
 * - The URL polyfill is required by supabase-js in the RN runtime.
 *
 * Returns null when Supabase is not configured, so callers fall back to the stub.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './config';

let cached: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  cached = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

  return cached;
}
