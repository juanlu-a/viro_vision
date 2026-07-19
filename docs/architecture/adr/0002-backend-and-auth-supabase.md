# ADR 0002 — Backend & auth: Supabase as the online account layer

- **Status:** Accepted
- **Date:** 2026-07-09
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** app, backend, auth, requirement
- **Relates to:** [ADR 0001 — Offline-first](0001-offline-first-on-device-inference.md)

> **Update (2026-07-18):** the login method is **email + password** (Supabase native auth) — the
> earlier draft of this ADR specified Google OAuth (web redirect); that has been dropped. Everything
> else (Supabase as the online account layer, strictly separated from the offline core) stands.

## Context

ViroVision needs user accounts: **login (email + password)**, a user profile, synced settings, saved history,
and a way to distribute **model-file updates**. All of these require the internet.

At the same time, ADR 0001 makes offline recognition a hard requirement. So we need a backend for the
account features **without** letting it creep onto the essential recognition path. A recurring
misconception to guard against: "the backend/API should host the model." For **inference**, that is
explicitly rejected by ADR 0001 — inference runs locally. The backend may host the model **file**
(for OTA download + local caching), but never serve inference for the essential path.

## Decision

**Adopt Supabase as the online account layer, strictly separated from the offline recognition core.**

1. **Two layers, one boundary rule.**
   - **Offline core** (in the app / on the device): bundled model + local inference + local storage.
     Works with zero internet.
   - **Online account layer** (Supabase): auth, profile, settings/history sync, model-file hosting.
   - **Boundary rule:** *nothing on the camera → detection/OCR → announcement path may `await` a
     network call.* Auth/sync live in their own modules and always degrade gracefully.

2. **Supabase provides** Auth (email + password — no Google/OAuth), Postgres (with Row Level Security per user), and
   Storage (model files / assets). Realtime and Edge Functions are available but not required.

3. **Session persistence / offline login.** The Supabase session is persisted in device secure
   storage. App access is gated on the **presence of a stored session**, not on a live network call.
   Token auto-refresh failing while offline **must not sign the user out**; the session is refreshed
   silently once connectivity returns. Only an explicit `signOut()` (or a refresh token expired after
   a very long offline period) ends the session — matching normal app behavior.

4. **Model files, not inference.** If served from the backend, models are **downloaded once and
   cached**, then run locally. The recognition path never depends on Supabase.

## Alternatives considered

- **Firebase (Auth + Firestore):** strong built-in *offline data sync*, native Google auth. Rejected
  as the primary: we don't need offline data sync for the essential path (recognition is local, not
  account data), and Postgres + open-source/self-hostable Supabase is a cleaner, less lock-in story
  to defend in a thesis.
- **Custom backend (FastAPI/Node + Postgres):** maximum control, but too much build/ops cost for a
  three-person thesis; Supabase gives the same Postgres with auth/storage handled.
- **Auth-only providers (Auth0/Clerk):** solve login but still need a separate data backend; more
  moving parts than Supabase.

## Consequences

**Positive**
- Email login, per-user data (RLS), and asset hosting with minimal backend work; generous free tier.
- Open-source / self-hostable → mitigates vendor lock-in.
- Clean separation keeps the offline guarantee (ADR 0001) intact.

**Costs / constraints**
- Supabase is **not offline-first for data mutations** (no offline write queue/replay). Acceptable,
  since account data is non-essential; if offline edits that sync are needed later, add a local-first
  layer (SQLite / WatermelonDB / Legend-State / PowerSync).
- Requires care so no essential code path awaits Supabase (enforced by the boundary rule above).
- Email auth keeps setup minimal: no Google Cloud OAuth client, no redirect/deep-link config — just
  enable Email auth in Supabase (and decide whether email confirmation is required).
- Config via env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `app/.env.example`).

## Implications for the current code

- New app layers (scaffolded as typed **stubs**, no live wiring yet, mirroring the BLE/audio stubs):
  - `app/src/features/auth/` — auth session state machine + `useAuth` hook.
  - `app/src/services/supabase/` — `SupabaseAuthClient` interface + honest stub.
- The recognition and device layers are untouched — they have no dependency on auth or the backend.

See also: `.claude/skills/virovision/SKILL.md` and `references/app.md`.
