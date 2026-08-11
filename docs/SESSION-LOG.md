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
- **Pantalla:** `dev/vision-bench` es una **ruta, no una pestaña**. El enlace desde Ajustes aparece
  con `__DEV__` **o con clave cargada**: así el benchmark también existe en un build de release
  local — necesario para medir en la calle sin la laptop — y desaparece solo en cualquier build que
  no lleve clave. Primera navegación programática del proyecto (`router.push`).
- **ADR 0001 enmendado** con nota fechada: la nube pasa a **acelerador opcional** con lo local como
  **fallback garantizado**; la nube como único camino sigue prohibida. Alinea el ADR con lo acordado
  con el tutor.
- **Riesgo documentado:** las claves `EXPO_PUBLIC_GEMINI_API_KEY` / `EXPO_PUBLIC_ANTHROPIC_API_KEY`
  se inlinean en el bundle JS. Es
  instrumentación de tesis, no puede viajar en un build distribuible; queda advertido en
  `.env.example`.
- **Modelo y respuesta, decididos priorizando velocidad:** el proveedor primario es **Gemini**
  (tier gratuito sin tarjeta y, sobre todo, de la misma familia que Gemma: comparar Gemma local
  contra Gemini en la nube cambia una sola variable). Por defecto **Gemini 3.6 Flash**; Anthropic
  queda como segundo proveedor opcional. El default real es *el primer modelo cuyo proveedor tiene
  clave cargada* (`defaultModel()`). La respuesta se reduce a **dos campos: `numero` y `nombre`** —
  menos salida es menos latencia, y son los dos datos que el anuncio de voz necesita. Se le pide
  explícitamente devolver `null` antes que adivinar: para un usuario ciego un número inventado es
  peor que un "no pude leerlo".
  Cambiar de modelo **no es cambiar un string**: la API responde 400 —no ignora— parámetros que el
  modelo no admite, y Haiku 4.5 rechaza `output_config.effort` y no soporta thinking adaptativo. De
  ahí el registro de perfiles en `config.ts` y el armado de request en `providers/anthropic.ts` y
  `providers/gemini.ts` (prompts compartidos en `providers/prompts.ts`), módulos puros y testeados.
  El motor de medición quedó aparte en `benchmark.ts`, agnóstico del proveedor.
- **Gemma local, restricción encontrada:** no se puede conectar a un modelo que corre dentro de otra
  app — iOS aísla cada app en su sandbox. Los caminos reales son (a) que la app de Gemma exponga un
  servidor HTTP local, y ahí el adapter es trivial porque `sse.ts` y las métricas son agnósticas del
  proveedor, o (b) embeberlo con **LiteRT-LM** dentro de ViroVision — no MediaPipe LLM Inference,
  que quedó en modo mantenimiento. Es el "Camino A" del tutor, formalizado en ADR 0004. Pendiente de averiguar cuál app/versión se está usando. Dato valioso: Gemma probado a mano
  en el iPhone **anda bien**, lo que valida el Camino A antes de invertir en él.
- tsc / lint / 52 tests / bundle iOS + Android en verde. Nada del código nuevo es iOS-only.
- **El incidente de TCC de macOS volvió a pasar** (ya había ocurrido el 18/07), esta vez a mitad de
  sesión: todo comando de npm dentro del repo moría con `EPERM: uv_cwd`, y `git` no podía leer el
  directorio. Los permisos Unix estaban intactos — era TCC bloqueando la carpeta Documentos. La
  lección nueva, que en julio faltaba: **abrir una pestaña o ventana nueva de Terminal no arregla
  nada**, porque son hijas del mismo proceso `Terminal.app` y TCC se evalúa al arrancar la app. Se
  resolvió con `tccutil reset SystemPolicyDocumentsFolder com.apple.Terminal` + ⌘Q. Xcode tiene su
  propio permiso, así que compilar con ⌘R sigue funcionando aunque la terminal esté bloqueada.
  Todo esto quedó en la sección "Problemas conocidos" de `dev-build-ios.md`.

## 2026-08-11 — Marca, temas, y el benchmark andando en el teléfono

- **Dev build en iPhone resuelto de punta a punta.** Se pelearon cuatro bloqueos encadenados, todos
  documentados en [`dev-build-ios.md`](dev-build-ios.md): provisioning gratuito (el perfil se emite
  atado a un dispositivo, así que "Try Again" no puede funcionar hasta que haya uno registrado),
  Modo de desarrollador del teléfono, TCC de macOS, y `ENABLE_USER_SCRIPT_SANDBOXING` bloqueando la
  escritura de `ip.txt`. La app corre hoy en un iPhone 15 Pro en Debug y en **Release** — o sea,
  sin laptop, que es lo que hace falta para medir en la calle.
- **Gemini como proveedor primario.** Anthropic y OpenAI exigen tarjeta; Gemini tiene tier gratuito
  sin ella. Y resultó mejor experimento: **misma familia que Gemma**, así que comparar local vs.
  nube cambia una sola variable. Probado contra la API real antes de compilar, lo que destapó que
  los eventos se discriminan por `event_type` y no por `type` — leerlo mal descartaba todos los
  eventos en silencio, con TTFT en `NaN` y sin ningún error visible.
- **Cuota del tier gratuito: 20 requests/minuto.** Reproducido con curl. La medición bajó de 7 a 5
  llamadas y el benchmark ahora espera lo que la API pide (`Please retry in 29.2s`) y reintenta esa
  corrida. Con menos muestras el p90 pasa a ser el máximo, así que la tabla lo rotula como tal:
  un percentil sobre 4 valores aparenta un rigor que no tiene.
- **Revisión con cuatro agentes en paralelo** (tres + Codex). 25 defectos reales. El más grave era
  de accesibilidad: **`accessibilityLiveRegion` es sólo Android**, así que en iPhone un usuario de
  VoiceOver no escuchaba ningún mensaje de estado — en una pantalla que es, entera, una máquina de
  estados. Tres eran de medición y producían números falsos sin fallar a la vista: tokens de salida
  de Anthropic siempre los iniciales, `doneAt` latcheando en el primer evento terminal (que difería
  entre proveedores), y `requestSentAt` marcado antes de serializar un cuerpo de varios MB.
- **Identidad de marca aplicada.** Ícono propio generado desde los SVG del manual, con dos
  desviaciones deliberadas por cómo renderiza cada sistema (iOS sin redondear, Android al 50 %).
  El manual se editó dos veces durante la sesión —el Azul Profundo pasó a `#061D3A` y se agregó una
  sección de modo claro/oscuro— y cada vez se regeneraron íconos y tokens.
- **Los tokens de color NO son los hex del manual**, y `theme.test.ts` lo verifica: tres colores del
  manual fallan WCAG como texto (Azul Sensor sobre Azul Profundo da 2.66:1). No es un error del
  manual —un logo no es texto— pero usarlos como color de interfaz habría degradado la accesibilidad
  por debajo del tema anterior. El test ya atajó dos regresiones invisibles a ojo: `borderStrong`
  cayendo bajo 3:1 al oscurecer el manual, y el acento cambiando de color entre temas.
- **Selector de tema** (sistema / claro / oscuro) persistido en AsyncStorage, no en Supabase: es una
  preferencia de accesibilidad y tiene que funcionar sin red ni cuenta. Va como `radiogroup` y el
  estado seleccionado cambia también el grosor del borde, no sólo el relleno.
- **Barra de pestañas nativa** (`NativeTabs`): Liquid Glass en iOS 26, Material en Android. Más allá
  de lo estético, hereda del sistema el manejo de foco, rotor de VoiceOver y tamaños de texto, que
  en una barra dibujada a mano habría que reimplementar y mantener.
- **Pantalla de dispositivo** con nombre, batería y firmware. La batería se comunica por texto y la
  barra es sólo refuerzo visual. Como BLE sigue siendo un stub, hay un dispositivo simulado detrás
  de `EXPO_PUBLIC_SIMULATE_DEVICE`, rotulado como tal: no finge que el Bluetooth funciona.
- **ADR 0004** escrito (Proposed): Gemma vía **LiteRT-LM**, no MediaPipe LLM Inference, que quedó en
  mantenimiento. Deja explícita la pregunta de alcance para el tutor: si Gemma multimodal lee el
  cartel directamente, ¿sigue haciendo falta el pipeline YOLO + OCR en el camino del teléfono?
- **Restricción encontrada:** el sandbox de iOS impide usar el Gemma que corre en otra app. Tenerlo
  andando en Edge Gallery prueba viabilidad sobre el hardware objetivo, pero no acerca el producto.
- 97 tests, tsc, lint y bundles iOS + Android en verde. PR #10 abierto.

## Open threads / next
- Merge **PR #7** (email/password auth).
- Install the iOS simulator runtime to see the app (or run on a real device via EAS dev build).
- Pending interactive setup: **Supabase** project + `app/.env`; **EAS** `login`/`init` + `EXPO_TOKEN` +
  `EAS_ENABLED`; **Apple** Developer account (device builds only). See `PROJECT-STATUS.md`.
- Start **Track A / A1** (design system + accessibility foundation) and **A2** (permissions), and
  **Track B / B1** (datasets + YOLO11).
