/**
 * Supabase configuration read from public env vars (see app/.env.example).
 * EXPO_PUBLIC_* vars are inlined into the bundle at build time.
 *
 * When these are absent (e.g. no backend configured yet), `isSupabaseConfigured` is false and the
 * app falls back to the offline-safe auth stub — keeping the app runnable with no backend.
 */
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
