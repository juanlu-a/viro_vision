# Supabase backend & Google auth

The online account layer (ADR 0002). Login uses **Supabase OAuth with a Google web redirect**:
`signInWithOAuth('google')` opens the system browser, then the app exchanges the returned code for a
session, which AsyncStorage persists so the user stays signed in offline.

The app code is wired and env-gated: with no `EXPO_PUBLIC_SUPABASE_*` vars it falls back to an
offline-safe stub (Settings shows "login not configured yet"); with them set, real Google sign-in
works. End-to-end login can only be tested against a real Supabase project.

## App wiring (already in the repo)

- `app/src/services/supabase/config.ts` — reads `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`.
- `app/src/services/supabase/supabase.ts` — memoized supabase-js client (AsyncStorage session,
  `detectSessionInUrl: false`, url polyfill).
- `app/src/services/supabase/authClient.ts` — OAuth web-redirect flow (open browser → exchange code).
- `app/src/services/supabase/client.ts` — `getSupabaseAuthClient()` returns the real client when
  configured, else the stub.
- Consumed by `features/auth/useAuth.ts`, surfaced in the Settings screen.

Redirect deep link: `Linking.createURL('auth/callback')` → `virovision://auth/callback` in a build
(and an `exp://…` URL in dev). The `virovision` scheme is set in `app.json`.

## One-time setup

1. **Create the Supabase project** (supabase.com) → copy the **Project URL** and **anon public key**.
2. **Google Cloud OAuth** → create an OAuth 2.0 **Web** client. Authorized redirect URI:
   `https://<PROJECT-REF>.supabase.co/auth/v1/callback`. Copy client ID + secret.
3. **Supabase → Authentication → Providers → Google** → enable, paste the client ID + secret.
4. **Supabase → Authentication → URL Configuration → Redirect URLs** → allow-list the app deep links:
   - `virovision://auth/callback` (built app)
   - the dev redirect (e.g. `exp://127.0.0.1:8081/--/auth/callback`) while developing
5. **Local env:** copy `app/.env.example` → `app/.env` and fill both `EXPO_PUBLIC_SUPABASE_*` values.
6. **CI/EAS:** `EXPO_PUBLIC_*` vars are inlined at build time, so add them where builds run — e.g. an
   `env` block per profile in `eas.json`, or EAS environment variables — for EAS builds/updates that
   should ship with the backend configured.

## Boundary rule

Supabase is the account layer only. Nothing on the camera → detection/OCR → announcement path may
depend on it (ADR 0001). Losing connectivity must never break recognition or a persisted session.
