# ViroVision — Project status & session handoff

_Living status/continuation doc. Last updated: 2026-09-02._

This captures where the project stands so anyone (including a fresh Claude Code session, together with
the `virovision` skill) can continue. It is a summary of work done across the setup sessions — not a
raw chat transcript.

---

## Current state — everything is in `main` ✅

All setup work (scaffold, CI/CD, EAS config, Supabase auth) is merged into `main` and CI is green.
The stale feature branches have been deleted; branch from an up-to-date `main` for new work.

> History note: PRs #1–#4 were **stacked**, so #2–#4 initially merged into intermediate branches
> rather than `main`; they were then consolidated into `main` via PR #5. Lesson: don't stack PRs
> unless each base is retargeted to `main` as it merges — prefer branching each change from `main`.

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
  API. **Amended 2026-08-10:** the cloud is allowed as an **optional accelerator** on the
  recognition path, with local inference as the guaranteed fallback; cloud-only recognition stays
  forbidden.
- **ADR 0002 — Backend & auth:** Supabase was the online account layer, but **the app now ships
  WITHOUT login** (opens directly to the tabs; offline-first, Apple doesn't require login). The
  Supabase email-auth code is **archived** — present but not wired into navigation — kept for a
  possible future *optional* sync. If login ever returns → email + password, never Google/OAuth.
- **ADR 0004 — On-device inference runtime** *(Proposed; actualizado 2026-08-13 y 2026-08-22)*:
  proponía Gemma vía LiteRT-LM; el spike mostró que su visión está rota en iOS y que el VLM por
  ExecuTorch funciona pero tarda 6,4 s. La pregunta del runtime se resuelve **por caso de uso** →
  ADR 0006.
- **ADR 0006 — Pipelines por caso de uso** *(Proposed 2026-08-22, a validar con tutor; actualizado
  2026-08-30 y 2026-09-01)*: **bondis = local** (detección preentrenada en la Coral TPU → recorte
  del banner → OCR; la TPU pasa a **preprocesadora**); **supermercado = LLM con visión en la nube**,
  con **cinco modelos elegidos por latencia** en el selector. Cae la gratuidad como restricción del
  proyecto (se paga para poder comparar) y sigue vigente para el usuario final. La precisión se mide
  con **datasets de evaluación** (recall / precision / accuracy / F1) — nada se entrena. Ver
  `docs/pruebas-y-decisiones.md`.
- **ADR 0008 — Proxy propio para las claves de nube** *(Accepted 2026-09-01)*: `EXPO_PUBLIC_*` se
  compila dentro del `.ipa`, así que las claves salen a una **Supabase Edge Function** que las
  inyecta del lado del servidor. Cierra el pendiente (b) de ADR 0006. El ADR compara las cinco
  opciones evaluadas y deja escrito qué compra el proxy y qué no (el endpoint sigue siendo abusable;
  lo que cambia es poder rotar o cortar en segundos).
- **ADR 0007 — Botones físicos y modos** *(Proposed 2026-08-22)*: 1 click = modo ómnibus, 2 clicks
  = modo supermercado, click largo = esperando. Nunca audio no solicitado. Diagrama canónico en
  `docs/architecture/README.md`.
- **Git convention:** no AI co-author trailers on commits/PRs (also in the skill).

## App tech stack

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 · New Architecture (JSI) · Expo Router.
Key deps: `react-native-ble-plx`, `expo-speech`, `expo-audio`, `@supabase/supabase-js`,
`@react-native-async-storage/async-storage`, `react-native-url-polyfill`;
tests via `jest-expo`.

## What's done per pillar

**App** (structure + honest stubs):
- Screens: **iOS bottom tabs, no login** — `index` (Home + **working TTS** "Probar audio"), `connect`
  (Dispositivo / BLE status), `settings` (appearance + about). Green/black design system + light mode.
- Domain layers under `app/src/`: `features/{recognition,device,audio,auth}`,
  `services/{ble,audio,supabase,storage}`, `i18n` (Spanish strings), `types`.
- **BLE** = typed stub (`services/ble/bleClient.ts`) — GATT profile placeholders in
  `features/device/gatt.ts`. Not wired (needs a dev-client build + real device).
- **Audio routing** to the device earphone = documented TODO in `services/audio/tts.ts`.
- **Supabase auth** = **archived** (app has no login). The env-gated client (real/stub) + `AuthProvider`
  remain in the repo but are not wired into navigation — available if optional sync is added later.
- **Lector de Inicio por modos (ADR 0006/0007)**: `features/reader/` — modo ómnibus = OCR local
  (`services/ondevice/ocr.ts`, ExecuTorch), modo supermercado = nube (`services/vision/`:
  proveedores Gemini / OpenAI / Anthropic / Groq, SSE, schema, limitador de cuota por proveedor).
  Sin clave o sin internet, supermercado avisa. El modelo se elige en Inicio (modal accesible,
  persistido y revalidado contra los disponibles del build). **El selector ofrece dos modelos desde
  el 2026-09-02**: `gpt-5.6-luna` (default, mediana 1668 ms) y `qwen/qwen3.8-27b` en Groq (846 ms,
  gratis, pero ~4 lecturas/min). Gemini salió por la medición — rango 2820-32 586 ms. Ver
  [`docs/mediciones/`](mediciones/README.md). El laboratorio del spike se retiró
  (2026-08-30) y vive en la rama `spike/laboratorio-vision-local`.
- **Captura por cámara (2026-09-01)**: `services/camera/` — la cámara del teléfono ocupa el lugar de
  la placa del dispositivo mientras no hay hardware. Permiso pedido explícitamente y anunciado por
  voz; la foto se achica a 1024 px de lado mayor antes de subirla. La fototeca queda como segunda
  fuente, para pasarle la misma foto a varios modelos (dataset de evaluación).
- **Proxy de claves (ADR 0008)**: `supabase/functions/vision/` (primer código de servidor del repo)
  + `services/cloud/`. **Desplegado el 2026-09-02** en el proyecto `viro_vision`
  (`oxukvenxiqkjhksgoigq`), con las tres claves como secrets del servidor y verificado de punta a
  punta con la clave del cliente en vacío. `EXPO_PUBLIC_VISION_PROXY_URL` es secret del repo: **los
  builds ya no llevan ninguna clave de proveedor**. Sin esa variable el camino directo de desarrollo
  sigue igual. ⚠️ El tier gratuito pausa el proyecto por inactividad — ver el riesgo en ADR 0008.
- **Audio a archivo (apagado)**: `services/audio/sintesis.ts` deja un `.mp3` por lectura para el
  parlante del dispositivo. Detrás de `EXPO_PUBLIC_AUDIO_FILE_ENABLED` porque hoy nada lo consume.
- **QA**: `docs/qa-modo-supermercado.md` — checklist de punta a punta, partido por qué necesita cada
  bloque. Los pasos 8 y 9 son la corrida del dataset de evaluación.
- Tests: **169 en 14 suites**.

**CI/CD** (`.github/workflows/`, gated EAS jobs):
- `ci.yml` — on PRs to main / feature pushes: install → lint → typecheck → test → bundle (iOS+Android
  `expo export`). Green.
- `eas-update.yml` — push to main publishes an OTA **preview** update group.
- `eas-build-ios.yml` — manual iOS build.
- EAS jobs gated on repo var `EAS_ENABLED=true`; need secret `EXPO_TOKEN`. See `docs/ci-cd.md`.
- Note: `app/expo-env.d.ts` is committed (un-ignored) so `tsc` resolves Expo ambient types in CI.

**EAS** (`app/eas.json`): development / preview / production profiles bound to update channels;
opcional — la distribución real va por TestFlight desde Xcode.

**Hardware / ML**: not started (README stubs only).

## Verificado en dispositivo (2026-09-02)

Build `202609021823` en el grupo interno de TestFlight: **el primero que sale sin ninguna clave de
proveedor en el binario**. El modo supermercado funciona de punta a punta contra el proxy de
ADR 0008. Es el cierre práctico del pendiente (b) de ADR 0006.

## Pending — interactive / account setup (only the user can do)

1. **EAS** (run locally; in a Claude session use `! ` prefix):
   `cd app && eas login && eas init && eas update:configure`, then add repo **secret** `EXPO_TOKEN`
   and **variable** `EAS_ENABLED=true`. `eas init`/`update:configure` edit `app.json` — fold those in.
2. **Supabase — hecho (2026-09-02).** El proyecto existía desde el 18/07 y estaba pausado y vacío
   (0 usuarios, 0 tablas, 0 buckets); se despausó y se usó para desplegar el **proxy de claves**
   (ADR 0008), que es para lo que sirve hoy — la capa de cuenta de ADR 0002 sigue archivada y la app
   no tiene login. Pendiente menor, dos toggles del dashboard: **rotar el JWT secret** y **apagar el
   signup por email**, que no usamos y deja un endpoint abierto para crear usuarios.
3. **Apple Developer Program — listo (2026-08, cuenta Individual del Apple ID del proyecto).**
   **TestFlight funcionando punta a punta (2026-08-31)**: `staging` → grupo interno *Equipo
   ViroVision* (devs, sin revisión, llega en minutos); PR `staging → main` (= release) → grupo
   externo *Testers ViroVision*. La Beta App Review del release del PR #44 fue **aprobada** y el
   **link público está vivo**: <https://testflight.apple.com/join/jbE7GDqV> (el grupo interno no
   tiene link: sus testers son usuarios de App Store Connect). Una sola app. Flujo en
   [`dev-build-ios.md`](dev-build-ios.md).
4. **Android / Google Play — en curso (2026-08-30)**: upload key generada, scripts y workflow
   listos y gateados con `PLAY_ENABLED`. Falta la cuenta de Google Play Console (USD 25),
   crear la app, la service account y la primera subida manual. Ver
   [`android-play.md`](android-play.md).

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
