# ViroVision — Project status & session handoff

_Living status/continuation doc. Last updated: 2026-07-10._

This captures where the project stands so anyone (including a fresh Claude Code session, together with
the `virovision` skill) can continue. It is a summary of work done across the setup sessions — not a
raw chat transcript.

---

## ⚠️ Read this first — `main` is missing merged work

PRs #2, #3, #4 show **MERGED**, but they were **stacked** (each based on the previous feature branch),
so they merged into their intermediate branches — **not into `main`**. As of now:

- **`main` contains only the scaffold (#1):** monorepo + knowledge skill + ADRs + RN app.
- **CI/CD, EAS config, and Supabase auth are NOT in `main`.** They are complete, green, and live on
  the branches — the full, linear stack is on **`feat/supabase-auth`** (tip contains everything).

### How to fix (get everything into `main`)
Open one PR from the top-of-stack branch into main and merge it (the scaffold is already in main, so
the diff is just CI + EAS + Supabase):

```bash
gh pr create --base main --head feat/supabase-auth \
  --title "Consolidate CI/CD, EAS config, and Supabase auth into main"
# review, then merge
```

After merging, delete the stale feature branches (`feat/ci-cd`, `feat/eas-setup`,
`feat/scaffold-monorepo-and-app`, `feat/supabase-auth`).

> Lesson for next time: don't stack PRs unless each base is retargeted to `main` as it merges. Prefer
> branching each change from an up-to-date `main`.

---

## What ViroVision is (one paragraph)

Thesis project (Ing. en Telemática, Facultad de Ingeniería, Montevideo, 2026 — Juan Lucas Abreu,
Magalí Dellapiazza, Francisco Tauber). An assistive system for people with low/no vision that
identifies **metropolitan bus lines** and **basic-basket supermarket products** and gives **real-time
auditory feedback**, via a glasses-mounted camera device paired with a mobile app. Dev target
~mid-Nov 2026; hard deadline **30 Nov 2026**. Full context: the `virovision` skill
(`.claude/skills/virovision/`).

## Repo layout (monorepo)

```
app/        React Native (Expo) app        ← main work so far
hardware/   RPi Zero 2 W + Coral TPU + Cam Module 3   (README stub only)
ml/         YOLO11 detection, OCR, Edge AI  (README stub only)
docs/       thesis deliverables, ADRs, this file
.claude/skills/virovision/   knowledge skill
```

## Key decisions (ADRs in `docs/architecture/adr/`)

- **ADR 0001 — Offline-first:** essential recognition (detection, OCR, audio) MUST work with no
  internet; the model runs **locally** (on device or bundled on the phone), never a cloud inference
  API. Internet only for non-essential features.
- **ADR 0002 — Backend & auth:** **Supabase** is the online account layer (Google login, profile,
  sync, model-file hosting), strictly separated from the offline core. A signed-in user stays signed
  in offline.
- Google login method chosen: **Supabase OAuth web redirect** (`signInWithOAuth`).
- **Git convention:** no AI co-author trailers on commits/PRs (also in the skill).

## App tech stack

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 · New Architecture (JSI) · Expo Router.
Key deps: `react-native-ble-plx`, `expo-speech`, `expo-audio`, `@supabase/supabase-js`,
`@react-native-async-storage/async-storage`, `expo-auth-session`, `react-native-url-polyfill`;
tests via `jest-expo`.

## What's done per pillar

**App** (structure + honest stubs):
- Screens: `index` (Home — navigation + **working TTS** "Probar audio"), `connect` (BLE, live-region
  status), `settings` (account / Google sign-in).
- Domain layers under `app/src/`: `features/{recognition,device,audio,auth}`,
  `services/{ble,audio,supabase,storage}`, `i18n` (Spanish strings), `types`.
- **BLE** = typed stub (`services/ble/bleClient.ts`) — GATT profile placeholders in
  `features/device/gatt.ts`. Not wired (needs a dev-client build + real device).
- **Audio routing** to the device earphone = documented TODO in `services/audio/tts.ts`.
- **Supabase auth** = wired + env-gated: no `EXPO_PUBLIC_SUPABASE_*` → offline-safe stub; configured →
  real Google OAuth (browser → exchange code → AsyncStorage-persisted session).
- Tests: `app/src/features/recognition/format.test.ts` (5 passing).

**CI/CD** (`.github/workflows/`, gated EAS jobs):
- `ci.yml` — on PRs to main / feature pushes: install → lint → typecheck → test → bundle (iOS+Android
  `expo export`). Green.
- `eas-update.yml` — push to main publishes an OTA **preview** update group.
- `eas-build-ios.yml` — manual iOS build.
- EAS jobs gated on repo var `EAS_ENABLED=true`; need secret `EXPO_TOKEN`. See `docs/ci-cd.md`.
- Note: `app/expo-env.d.ts` is committed (un-ignored) so `tsc` resolves Expo ambient types in CI.

**EAS** (`app/eas.json`): development / preview / production profiles bound to update channels;
preview builds an iOS **simulator** app (no Apple account needed).

**Hardware / ML**: not started (README stubs only).

## Pending — interactive / account setup (only the user can do)

1. **EAS** (run locally; in a Claude session use `! ` prefix):
   `cd app && eas login && eas init && eas update:configure`, then add repo **secret** `EXPO_TOKEN`
   and **variable** `EAS_ENABLED=true`. `eas init`/`update:configure` edit `app.json` — fold those in.
2. **Supabase** (see `docs/supabase.md`): create project → enable Google provider → allow-list
   `virovision://auth/callback` (+ dev redirect) → Google Cloud OAuth web client → fill `app/.env`.
3. **iOS Developer account** — enroll in the Apple Developer Program ($99/yr); then EAS handles signing.

## What's next — options (was mid-discussion)

Pick a track (see the skill for pillar detail):

- **A. Recognition pipeline in the app (highest-value, demoable now, no hardware):** integrate the
  camera (`expo-camera`) + an on-device model runtime (e.g. `react-native-fast-tflite` /
  `onnxruntime-react-native` / `react-native-executorch`) running a YOLO model, produce
  `RecognitionEvent`s (types already exist in `features/recognition/types.ts`) and feed the existing
  `announceRecognition` (`features/audio/announcer.ts`). Aligns with offline-first (ADR 0001). A
  COCO-pretrained YOLO already detects `bus`, so an end-to-end demo is possible before custom training.
- **B. Finish the account layer:** after EAS/Supabase setup, add auth-gated navigation (login route +
  guard), profile, and persist settings to Supabase.
- **C. Real BLE:** replace the `services/ble` stub with a live `react-native-ble-plx` client (needs a
  dev-client build; testable against a mock peripheral until firmware exists).
- **D. ML pillar (Python, `ml/`):** datasets for buses + products, train/fine-tune YOLO11, export to
  TFLite/edge.
- **E. Hardware pillar:** RPi firmware, BLE peripheral (GATT server matching `gatt.ts`), camera capture
  (blocked on buying hardware).

**Recommendation:** **A** — it delivers a working, testable recognition demo now, de-risks the core
value prop, and exercises the recognition/audio domain already scaffolded.

## How to continue in a new session

1. The `virovision` skill loads automatically for ViroVision work.
2. Read this file for current state.
3. First action should likely be consolidating `main` (see the top section).
