# Supabase backend & email auth

The online account layer (ADR 0002). Login uses **Supabase email + password** (Supabase native auth —
no Google, no OAuth). On sign-in the session is persisted by AsyncStorage, so the user stays signed in
across restarts and while offline.

The app code is wired and env-gated: with no `EXPO_PUBLIC_SUPABASE_*` vars it falls back to an
offline-safe stub (Settings shows "login not configured yet"); with them set, real email sign-in /
sign-up works. End-to-end login can only be tested against a real Supabase project.

## App wiring (already in the repo)

- `app/src/services/supabase/config.ts` — reads `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`.
- `app/src/services/supabase/supabase.ts` — memoized supabase-js client (AsyncStorage session,
  `detectSessionInUrl: false`, url polyfill).
- `app/src/services/supabase/authClient.ts` — email auth (`signInWithPassword` / `signUp`).
- `app/src/services/supabase/client.ts` — `getSupabaseAuthClient()` returns the real client when
  configured, else the stub.
- Consumed by `features/auth/useAuth.ts` (`signIn` / `signUp` / `signOut`), surfaced in the Settings
  screen's Account section (email + password form).

## One-time setup

1. **Create the Supabase project** (supabase.com) → copy the **Project URL** and **anon public key**
   (Settings → API).
2. **Enable Email auth:** Supabase → *Authentication → Providers → Email* (on by default).
3. **Email confirmation:** decide whether to require it (*Authentication → Sign In / Providers →
   Confirm email*). For quick testing, turn it **off** so `signUp` returns a session immediately; for
   production, keep it **on** (then `signUp` returns no session until the user confirms — the app shows
   "revisa tu correo para confirmarla").
4. **Local env:** copy `app/.env.example` → `app/.env` and fill both `EXPO_PUBLIC_SUPABASE_*` values.
5. **CI/EAS:** `EXPO_PUBLIC_*` vars are inlined at build time, so add them where builds run — e.g. an
   `env` block per profile in `eas.json`, or EAS environment variables — for EAS builds/updates that
   should ship with the backend configured.

> No Google Cloud Console, OAuth client, or redirect-URL configuration is needed — email auth only.

## Boundary rule

Supabase is the account layer only. Nothing on the camera → detection/OCR → announcement path may
depend on it (ADR 0001). Losing connectivity must never break recognition or a persisted session.
