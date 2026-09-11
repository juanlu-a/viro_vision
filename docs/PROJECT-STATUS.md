# ViroVision — Project status & session handoff

_Living status/continuation doc. Last updated: 2026-09-11._

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
hardware/   RPi Zero 2 W + Coral TPU + Cam Module 3 + UPS HAT (C)   raspi/ = daemon BLE (ADR 0003)
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
- **BLE** = cliente real sobre `react-native-ble-plx` detrás del selector de `services/ble/bleClient.ts`
  (stub tipado en Expo Go / web). Perfil GATT de 128 bits en `features/device/gatt.ts`, espejo de
  `hardware/raspi/virovision/gatt.py`. Necesita development build. Los botones de medición del spike
  del ADR 0003 (**Medir transferencia** y **Medir por WiFi**) se retiraron el 2026-09-08: la decisión
  ya está tomada (WiFi) y con ellos se fue el reensamblado por chunks del lado de la app.
- **Audio routing** to the device earphone = documented TODO in `services/audio/tts.ts`.
- **Supabase auth** = **archived** (app has no login). The env-gated client (real/stub) + `AuthProvider`
  remain in the repo but are not wired into navigation — available if optional sync is added later.
- **Lector de Inicio por modos (ADR 0006/0007)**: `features/reader/` — modo ómnibus = OCR local
  (`services/ondevice/ocr.ts`, ExecuTorch), modo supermercado = nube (`services/vision/`:
  proveedores Gemini / OpenAI / Anthropic / Groq, SSE, schema, limitador de cuota por proveedor).
  Sin clave o sin internet, supermercado avisa. El modelo se elige en **Ajustes** (modal accesible,
  persistido y revalidado contra los disponibles del build; el estado lo comparte
  `ProductModelProvider`, que es quien alimenta la lectura en Inicio). **El selector ofrece dos modelos desde
  el 2026-09-02**: `gpt-5.6-luna` (default, mediana 1668 ms) y `qwen/qwen3.8-27b` en Groq (846 ms,
  gratis, pero ~4 lecturas/min). Gemini salió por la medición — rango 2820-32 586 ms. Ver
  [`docs/mediciones/`](mediciones/README.md). El laboratorio del spike se retiró
  (2026-08-30) y vive en la rama `spike/laboratorio-vision-local`.
- **Captura (2026-09-08)**: `services/camera/` — la foto la saca **siempre la cámara de la placa** y
  baja por WiFi (`GET /photos/latest`, ADR 0003), ya a 1024 px y calidad 70. La cámara del teléfono y
  la fototeca, que ocupaban ese lugar mientras no había hardware, se retiraron junto con
  `expo-image-picker` y los permisos de cámara y fotos: el producto tiene una sola fuente de imagen
  y sostener dos era mantener un camino que nadie recorre. **Consecuencia abierta**: el dataset de
  evaluación (pasos 8-9 de la QA) ya no se puede correr desde la app pasándole la misma foto a
  varios modelos; hay que correrlo fuera de la app o volver a habilitar una entrada de prueba.
- **Telemetría (2026-09-09)**: `services/telemetry/` + la función `telemetry` → tabla `events`.
  Es el reemplazo del diagnóstico que salió de las pantallas el 2026-09-08: arranque, BLE, red con la
  placa, estado de la placa, modos, la lectura de punta a punta con tiempos separados (foto vs.
  pipeline) y los crashes por el manejador global de RN. `record()` es sincrónico y no lanza —
  ADR 0001 le prohíbe estorbar al reconocimiento, y el linter le prohíbe entrar a `features/audio/` y
  `features/recognition/`. Cola con tope que descarta lo viejo, porque unido al AP de la placa hay
  WiFi sin internet y los envíos fallan seguido. Se enciende con `EXPO_PUBLIC_TELEMETRY_URL`; vacía,
  queda apagada entera. Detalle en [`docs/supabase.md`](supabase.md).
- **Idioma del código (2026-09-09, ADR 0009)**: todo el código pasó a inglés — identificadores,
  archivos, comentarios, tests, y también las **fronteras**: el protocolo BLE, los endpoints de la
  placa (`/health`, `/measure/<n>`, `/photos/latest`), los flags del daemon (`--no-ap`) y el esquema
  de Supabase (tabla `events`, vocabulario `reading.ok`). Sigue en español lo que una persona lee o
  escucha (los valores de `i18n/es.ts`, el prompt de supermercado) y **toda la documentación**.
  ✅ **Placa al día desde el 2026-09-10**: el daemon nuevo está instalado y verificado (`/health`
  con el payload en inglés, `/photos/latest` devolviendo la foto del IMX500, botón en GPIO 5, BLE
  anunciando), los **dos** `--sin-ap` de `bootfs` corregidos —estaban en `modo-red.sh` y también en
  `instalar-daemon.sh`— y el `.tgz` de la tarjeta refrescado con `staging`. La tarjeta quedó en modo
  producto y el flujo completo anda de punta a punta. El procedimiento de despliegue está en
  [`hardware/raspi/README.md`](../hardware/raspi/README.md).
- **Botón físico y lecturas repetidas (2026-09-10, ADR 0007 act.)**: un gesto nombra un modo desde
  cualquier estado, y **dos clicks piden una lectura siempre** — estando ya en supermercado, el doble
  click saca otra foto en vez de no hacer nada. El pedido viaja como evento propio
  (`{"t":"read","mode":N}`) y no como un cambio de modo, porque el modo no cambia. Un click **no**
  pide lectura: ómnibus es vigilancia y repetirlo costaría una foto y una llamada a la nube por toque.
  La app muestra además la foto que sacó la placa debajo del resultado. Placa y app desplegadas y
  verificadas juntas.
- **Segundo plano en iOS (2026-09-10/11, spike 1 de ADR 0003 — cerrado)**: con la pantalla bloqueada el doble
  click no hacía nada, que es exactamente el caso del producto. Resultó que **el modo de fondo nunca
  estuvo apagado** —`isBackgroundEnabled` no gatea el `Info.plist`, sólo el manifiesto de Android; el
  ADR y el log decían lo contrario y quedaron corregidos—. Lo que faltaba: **ninguna sesión de
  audio** (`expo-audio` estaba instalado y no lo importaba nadie), el **disparo del botón viajando
  por estado de React y servido por Inicio**, y **nada con qué diagnosticar** una corrida sin
  pantalla. Ahora hay `services/audio/session.ts` (`mixWithOthers` para no pisar VoiceOver, tono de
  mantenimiento mientras dura la lectura, chirp al empezar), el pipeline salió de la pantalla a
  `features/reader/readingService.ts` con `ReaderBridge` suscrito directo al cliente BLE, `announce()`
  se puede esperar, hay tope de 12 s por lectura, y la telemetría estampa el `AppState` en cada fila
  y vacía la cola al volver a primer plano. ✅ **Verificado en el teléfono el 2026-09-11** (build
  `202609110048`, bloque E de [`qa-modo-supermercado.md`](qa-modo-supermercado.md)): la lectura sale y
  se escucha bloqueada, varias seguidas, con VoiceOver vivo y también tras un rato largo bloqueado.
  **El spike 1 de ADR 0003 queda cerrado** y con él la hipótesis sobre la que está construido todo el
  enlace. Sigue abierto `restoreStateIdentifier` (si iOS **termina** la app, CoreBluetooth no la
  relanza): no hace falta para el caso probado, y es el PR siguiente del tema.
- **Proxy de claves (ADR 0008)**: `supabase/functions/vision/` (primer código de servidor del repo)
  + `services/cloud/`. **Desplegado el 2026-09-02** en el proyecto `viro_vision`
  (`oxukvenxiqkjhksgoigq`), con las tres claves como secrets del servidor y verificado de punta a
  punta con la clave del cliente en vacío. `EXPO_PUBLIC_VISION_PROXY_URL` es secret del repo: **los
  builds ya no llevan ninguna clave de proveedor**. Sin esa variable el camino directo de desarrollo
  sigue igual. ⚠️ El tier gratuito pausa el proyecto por inactividad — ver el riesgo en ADR 0008.
- **Audio a archivo (apagado)**: `services/audio/synthesis.ts` deja un `.mp3` por lectura para el
  parlante del dispositivo. Detrás de `EXPO_PUBLIC_AUDIO_FILE_ENABLED` porque hoy nada lo consume.
- **QA**: `docs/qa-modo-supermercado.md` — checklist de punta a punta, partido por qué necesita cada
  bloque. Los pasos 8 y 9 son la corrida del dataset de evaluación.
- Tests: **226 en 24 suites**.

**CI/CD** (`.github/workflows/`, gated EAS jobs):
- `ci.yml` — on PRs to main / feature pushes: install → lint → typecheck → test → bundle (iOS+Android
  `expo export`). Green.
- `eas-update.yml` — push to main publishes an OTA **preview** update group.
- `eas-build-ios.yml` — manual iOS build.
- EAS jobs gated on repo var `EAS_ENABLED=true`; need secret `EXPO_TOKEN`. See `docs/ci-cd.md`.
- Note: `app/expo-env.d.ts` is committed (un-ignored) so `tsc` resolves Expo ambient types in CI.

**EAS** (`app/eas.json`): development / preview / production profiles bound to update channels;
opcional — la distribución real va por TestFlight desde Xcode.

**Hardware**: firmware inicial en `hardware/raspi/` (daemon BLE + cámara + modos; `setup.sh` por SSH),
con **emulador para la Mac** (`python -m virovision.emulator`, mismo núcleo por CoreBluetooth) para
probar la app sin placa. Sin verificar en la placa todavía. **ML**: not started (README stub only).

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
- **C. Real BLE:** hecho el 2026-09-04 (cliente ble-plx + medición). Falta verificarlo contra la
  placa real y correr la medición del ADR 0003.
- **D. ML pillar (Python, `ml/`):** datasets for buses + products, train/fine-tune YOLO11, export to
  TFLite/edge.
- **E. Hardware pillar:** daemon inicial hecho el 2026-09-04 (`hardware/raspi/`). **Alimentación
  comprada el 2026-09-07**: Waveshare UPS HAT (C) + LiPo 1000 mAh (`hardware/README.md`, *Alimentación*).
  **Botón físico hecho el 2026-09-07** (`raspi/virovision/button.py`, GPIO 5 / pin 29).
  Siguen: DAC I2S + anuncios pregrabados, leer el INA219 del HAT → `estado.bateria`, medir
  el consumo real, pipeline de ómnibus en el Coral, carcasa.

**Recommendation:** **A** — it delivers a working, testable recognition demo now, de-risks the core
value prop, and exercises the recognition/audio domain already scaffolded.

## How to continue in a new session

1. The `virovision` skill loads automatically for ViroVision work.
2. Read this file for current state.
3. First action should likely be consolidating `main` (see the top section).
