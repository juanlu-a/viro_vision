# ViroVision — Session Log

Chronological log of the work done on ViroVision, so the project's history lives with the code. Newest
entries at the bottom of each day. For the current-state snapshot see [`PROJECT-STATUS.md`](PROJECT-STATUS.md);
for the forward plan see [`ROADMAP.md`](ROADMAP.md).

---

## 2026-07-08 — Kickoff: understand the thesis, scaffold the project

- **Read the thesis advancement document** ("Documento principal · ViroVision") and distilled it into a
  persistent **knowledge skill** at `.claude/skills/virovision/` (`SKILL.md` + per-pillar references
  `app.md` / `hardware.md` / `ml.md`). Captures the project (assistive device + app for low/no-vision
  users; identify **bus lines** and **supermarket products** with real-time **audio** feedback), the
  three pillars, constraints, and the thesis's open `PENDIENTE` items.
- **Decided (with the user):** monorepo with all 3 pillars; **Expo + dev client** for the app.
- **Scaffolded the monorepo:** `app/` (React Native/Expo), `hardware/`, `ml/`, `docs/`, each with a
  README; root README + `.gitignore`.
- **Bootstrapped the app:** Expo **SDK 57** · RN **0.86** · React **19** · TypeScript · New Architecture
  · **Expo Router**. Reshaped the starter into a domain structure (`features/{recognition,device,audio}`,
  `services/{ble,audio,storage}`, `i18n` Spanish, `components` accessible primitives). Delivered one
  **accessible Home screen** with working **TTS** ("Probar audio"), plus Connect and Settings screens.
  BLE and audio-routing left as **honest typed stubs**.
- **ADRs:** **0001 — Offline-first** (essential recognition runs locally, never a cloud inference API;
  internet only for non-essential features). **0002 — Backend & auth** (Supabase as the online account
  layer, strictly separated from the offline core).
- **Convention:** no AI co-author trailers on commits/PRs.
- Committed in logical commits; opened the work as PRs.

## 2026-07-09 — CI/CD, EAS config, Supabase auth

- **CI/CD:** added `jest-expo` testing (first suite on the recognition formatter, 5 tests) and GitHub
  Actions: `ci.yml` (install → lint → typecheck → test → bundle for iOS+Android) plus **gated** EAS
  workflows `eas-update.yml` (OTA preview updates) and `eas-build-ios.yml` (manual iOS build), gated on
  a repo variable `EAS_ENABLED`. Committed `expo-env.d.ts` so `tsc` resolves Expo ambient types in CI.
- **EAS config:** `app/eas.json` with development / preview / production profiles bound to update
  channels (preview builds an iOS **simulator** app — no Apple account needed).
- **Supabase auth (initial):** wired a real `@supabase/supabase-js` client (env-gated: offline-safe stub
  with no config), first implemented as **Google OAuth (web redirect)**. Session persisted via
  AsyncStorage (stays signed in offline).
- Opened these as a **stack of PRs** (#1 scaffold → #2 CI → #3 EAS → #4 Supabase).

## 2026-07-10 — Consolidate `main`, fix CI

- User merged **#1**. Discovered the stacked PRs #2–#4 had merged into their **intermediate branches,
  not `main`** — so `main` had only the scaffold. Opened **PR #5** (`feat/supabase-auth` → `main`) to
  consolidate CI/CD + EAS + Supabase; merged it; deleted the stale branches. `main` now had everything.
- **CI fix:** the first CI runs failed on `tsc` (`TS2882` for `@/global.css`) because `expo-env.d.ts`
  was gitignored and absent in CI. Un-ignored + committed it. All PRs went green.
- **Handoff doc:** added `docs/PROJECT-STATUS.md` (current-state snapshot). PR #6 later tidied its
  "main is stale" note after consolidation.
- **Lesson recorded:** don't stack PRs unless each base is retargeted to `main`; branch each change
  from an up-to-date `main`.

## 2026-07-18 — Roadmap, macOS permission incident, auth → email/password

- **Roadmap planning:** agreed on **two parallel tracks** — Track A (app foundation: design system +
  accessibility + permissions + login gate) and Track B (ML/OCR + hardware groundwork). Chose an **own
  design system** (no component library) and to **defer recognition integration** in the app until a
  real model/device exists. Roadmap captured in `docs/ROADMAP.md`.
- **macOS permission incident:** the session resumed in a new process that had lost **Documents-folder
  access** (macOS TCC). All repo access (git + file tools) returned `Operation not permitted`. Fixed by
  granting the terminal Full Disk Access and **restarting** the session (TCC binds at process launch).
- **Auth decision changed:** login is now **Supabase email + password only — no Google/OAuth**
  (simpler setup, more screen-reader-friendly). Implemented in **PR #7** (`feat/auth-email-password`):
  `signInWithEmail`/`signUpWithEmail`, accessible email+password form in Settings, removed the OAuth flow
  and `expo-auth-session`; updated ADR 0002 (dated note), `docs/supabase.md`, PROJECT-STATUS, and the
  skill. tsc/lint/tests/bundle green.
- **iOS simulator:** attempted `expo run:ios` (Xcode 26.6). Prebuild + CocoaPods succeeded, but
  `xcodebuild` fails to find a simulator destination — the installed simulator runtime is **iOS 26.2**
  while Xcode expects **iOS 26.5**. **Blocked on installing the matching iOS simulator runtime** (Xcode
  → Settings → Components, or `xcodebuild -downloadPlatform iOS`). App bundles fine via `expo export`.
- **Docs:** added this `SESSION-LOG.md` and `docs/ROADMAP.md`.

## 2026-08-10 — Reunión con el tutor: integración del modelo y performance

- **Primera reunión registrada con el tutor** sobre *dónde* corre la inferencia. Se creó
  `docs/REUNIONES-TUTOR.md` como registro de reuniones con el director de tesis; los apuntes completos
  (Gemma 2B en celular, *model gateway* dinámico local↔nube, caminos A–D de stack, capacidades de Gemma
  y recolección de datos) viven ahí.
- **Postura acordada sobre offline-first:** la nube pasa a ser **acelerador opcional** y lo local queda
  como **fallback garantizado** — el requisito "funciona sin internet" se mantiene. Esto **desalinea
  ADR 0001** (que hoy dice "never a cloud API"); queda pendiente enmendarlo formalmente.
- **Descartado:** correr Gemma en la RPi Zero 2 W (~0.5 GB de RAM no alcanzan). En el dispositivo
  sobrevive YOLO + Coral TPU. Afecta a **B2**.
- **iOS vs. Android sube a decisión bloqueante:** Apple Vision + Core ML es iOS-only, React Native
  Vision Camera es cross-platform; no se elige stack sin cerrar antes el perfil de usuario.
- **Próximos pasos del tutor:** probar Gemma con Edge Gallery en el celular · mock de llamada a nube
  desde la app para medir latencia · documentar Apple Vision + RN Vision Camera como alternativa ·
  validar perfil de usuario iOS vs. Android.

## 2026-08-10 (cont.) — Dev build en iPhone + benchmark de latencia en la nube

- **Dev build iOS por el camino gratis.** Fijado `ios.bundleIdentifier` / `android.package` =
  `com.virovision.app` (cerraba el pendiente A2), regenerado el proyecto nativo con
  `expo prebuild --clean -p ios`, y documentado el procedimiento completo de firma con Apple ID
  personal en [`dev-build-ios.md`](dev-build-ios.md) — incluida la **caducidad a los 7 días** y el
  paso de confiar en el certificado desde Ajustes del teléfono. El bloqueo del simulador del 18/07
  ya no aplica: el runtime iOS 26.5 está instalado.
- **Paso 2 del tutor implementado:** `app/src/services/vision/` mide latencia contra un modelo de
  visión en la nube leyendo el cartel de un ómnibus real. Métricas: hasta headers, hasta primer
  byte, hasta primer evento, **hasta el primer token (TTFT)** y total. Una corrida de calentamiento
  se descarta (handshake TLS + compilación del JSON Schema), las corridas son secuenciales, y se
  reporta mediana y p90 — nunca promedio con pocas muestras.
- **Decisión técnica:** HTTP crudo con streaming SSE sobre `expo/fetch`, no `@anthropic-ai/sdk`. El
  SDK declara que **React Native no está soportado**, y además su decoder se interpondría entre la
  red y el timestamp, ocultando el momento de los headers y del primer byte. Para un benchmark el
  instrumento tiene que ser más delgado que lo medido.
- **Pantalla:** `dev/vision-bench` es una **ruta, no una pestaña**, enlazada desde Ajustes sólo bajo
  `__DEV__`. Primera navegación programática del proyecto (`router.push`).
- **ADR 0001 enmendado** con nota fechada: la nube pasa a **acelerador opcional** con lo local como
  **fallback garantizado**; la nube como único camino sigue prohibida. Alinea el ADR con lo acordado
  con el tutor.
- **Riesgo documentado:** `EXPO_PUBLIC_ANTHROPIC_API_KEY` se inlinea en el bundle JS. Es
  instrumentación de tesis, no puede viajar en un build distribuible; queda advertido en
  `.env.example`.
- tsc / lint / 39 tests / bundle iOS + Android en verde. Nada del código nuevo es iOS-only.

## Open threads / next
- Merge **PR #7** (email/password auth).
- Install the iOS simulator runtime to see the app (or run on a real device via EAS dev build).
- Pending interactive setup: **Supabase** project + `app/.env`; **EAS** `login`/`init` + `EXPO_TOKEN` +
  `EAS_ENABLED`; **Apple** Developer account (device builds only). See `PROJECT-STATUS.md`.
- Start **Track A / A1** (design system + accessibility foundation) and **A2** (permissions), and
  **Track B / B1** (datasets + YOLO11).
