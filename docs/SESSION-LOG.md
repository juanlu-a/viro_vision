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

## 2026-08-11 (cont.) — La cuota de Gemini

- **La cuota se respeta antes de pedir, no después de fallar.** El tier gratuito admite 20 requests
  por minuto **por modelo**, y la app las topaba todo el tiempo. Tres causas, no una: el
  calentamiento se repetía en cada medición aunque no hubiera cambiado nada (una llamada tirada por
  medición), no había ningún límite propio, y el único freno era reaccionar al 429. Ahora hay un
  limitador de ventana móvil por modelo (17 de 20, con margen para lo que el servidor ya contó y
  nosotros no) que espera con aviso en vez de fallar.
- **El limitador espera *antes* de arrancar el cronómetro.** Si esperara con la medición ya
  iniciada, la espera se contaría como latencia del modelo y el número no significaría nada.
- Dos defectos del limitador los encontraron sus propios tests: `remainingSlots` ignoraba el máximo
  inyectado, y una señal ya abortada dormía el minuto entero —el listener de `abort` se registraba
  después de que el evento hubiera pasado, así que nunca se disparaba.
- **`gemini-flash-lite-latest` pasa a ser el modelo por defecto.** Verificado contra la API real:
  responde con el payload completo (imagen + streaming + salida estructurada) y tiene **su propia
  cuota**, separada de la de Flash — contestó mientras Flash estaba agotado.

## 2026-08-11 (cont.) — El manual de marca v1.0

- **El manual cambió de postura y la app lo siguió.** En la v1.0, **Verde Lectura es el primario**
  (botones, foco, estado confirmado) y el Azul Sensor pasó a secundario. Lo que hasta ayer estaba
  anotado en la skill como desviación deliberada de la app es, desde esta versión, lo que el manual
  dice. El piso de contraste del acento también lo fija el manual: 4.5:1, no 7:1.
- **Relleno y texto no pueden ser el mismo verde en modo claro.** `#1FB57A` da 6.39:1 con el texto
  azul profundo encima —el botón que dibuja el manual— pero 2.44:1 como color de texto. De ahí que
  `primary` sea un color de relleno y `success` uno de texto; en oscuro coinciden, en claro no
  pueden. El test lo verifica en las dos direcciones.
- Un detalle que se pasa por alto: el relleno verde sobre el fondo claro queda **por debajo del 3:1
  que WCAG 1.4.11 le exige al *límite* de un control**. Se resolvió contorneando el botón
  (`primaryEdge`), no aclarando el fondo ni oscureciendo la marca.
- El mismo test, extendido a las superficies, destapó que `borderStrong` del tema oscuro daba 2.65:1
  sobre las tarjetas: pasa a `#4D9BFF`, que es el azul secundario que el manual ya definía.
- **Tipografía de marca embebida** (Space Grotesk Bold, IBM Plex Sans, IBM Plex Mono) con el plugin
  `expo-font`, no cargada en runtime: un cambio de fuente a mitad del arranque es un salto de layout.
  Los `fontWeight` sueltos se reemplazaron por familia — con un archivo por peso, pedir además un
  peso dispara negrita sintética en Android. Piso de texto a 17 px, como pide el manual.
- **El símbolo son dos archivos, no uno recoloreado**: pupila azul profundo en claro, blanca en
  oscuro. Con una sola imagen el ojo se veía hueco en uno de los dos temas.
- El símbolo terminó **sólo en Inicio**. Estuvo un rato en todas las pantallas y se veía mal por una
  razón que no era la obvia: mide 48 y la línea del título 46, así que en Inicio el texto quedaba
  centrado sobre una fila más alta y *la misma tipografía se leía distinta*. La fila del título pasó
  a tener alto fijo, lleve símbolo o no.
- 109 tests, tsc y lint en verde.

## 2026-08-12 — Spike de Gemma local, Tailwind, y el resto mergeado

- **Se mergeó todo lo pendiente en tres PRs separados** (#11 cuota de Gemini, #12 manual de marca
  v1.0, #13 documentación de convenciones y decisiones en la skill), en secuencia y no apilados,
  como pide la regla del repo. Verificado con `git diff origin/main <rama-vieja>` que no se perdiera
  nada: el único delta era el encabezado del log, partido a propósito en dos entradas.
- **La skill del proyecto tenía afirmaciones que contradecían ADRs vigentes** — `app.md` y `ml.md`
  seguían diciendo "never a cloud API" y proponiendo TFLite/ONNX/ExecuTorch. Un agente que las
  leyera tomaba decisiones contra lo ya decidido. Corregido, y agregados `convenciones.md` y
  `decisiones.md`.
- **Spike de inferencia local (ADR 0004): el riesgo grande quedó descartado.**
  `react-native-litert-lm` compila contra Expo 57 / RN 0.86 y **el Gemma 3 1B carga y genera** en el
  iPhone. Todo lo demás que falló resultó ser gestión de disco, no viabilidad.
- Tres causas distintas se disfrazaron del mismo síntoma, y ninguna se podía adivinar desde afuera:
  la caché compilada va en la carpeta del modelo (un archivo de otra app se lee pero no se escribe
  al lado); el disco lleno hace que XNNPack llame a `abort()` sin decir por qué, fallando incluso
  con un modelo chico que antes andaba; y el Gemma 4 de Edge Gallery **no trae codificador de
  visión**. Las tres salieron de leer el Swift de la librería y los logs nativos del teléfono, no
  de probar variantes.
- **El muro del entitlement sigue sin tocarse**: no llegamos a cargar el modelo grande porque nos
  frenó el espacio en disco. Queda como la pregunta abierta, y es de presupuesto, no técnica.
- **Tailwind en nativo, vía NativeWind**, que es lo que documenta Expo SDK 57. Dos decisiones para
  que no empeorara lo que veníamos de ordenar: la paleta se movió a un archivo plano que consumen
  TypeScript y Tailwind (una sola fuente, y `theme.test.ts` sigue verificando el hex que la app
  usa), y cada color apunta a una variable CSS para que se escriba `bg-surface` una sola vez en vez
  de `bg-surface dark:bg-dark-surface`. No queda un `StyleSheet` en la app.
- Además: el scroll saltaba porque el inset superior se contaba dos veces con el header nativo; los
  botones `ghost` no se leían como botones; y el selector de tema pasó a un desplegable compacto —
  ocupando media pantalla, la apariencia parecía el ajuste más importante de la app.

## 2026-08-13 — El spike de visión local cierra: era la librería, no el teléfono

- **La visión de LiteRT-LM no funciona en iOS.** Aislado con método: tres modelos multimodales
  (756 MB, 1,4 GB, 2,5 GB) fallan idéntico sólo con visión activa; memoria (veredicto "safe" y
  fallaba igual), disco, contexto (1024→256 sin cambio), precisión y decodificado restringido,
  descartados uno por uno. Tres hipótesis mías murieron contra la evidencia en el camino — la de
  RAM documentada incluida, cuando el modelo de 756 MB también falló.
- **La contraprueba: ExecuTorch (MLX) sí ve.** El mismo Gemma 4 E2B multimodal carga en ~4 s y lee
  el cartel bien. Dos errores de uso en el medio, los dos medidos y arreglados: `forward()` sin la
  plantilla de chat devuelve vacío (`sendMessage()` la aplica), y sin decodificado restringido la
  forma del JSON tiene que ir en el prompt — el modelo inventaba claves. También leía la matrícula
  en vez del cartel hasta que el prompt lo prohibió.
- **Pero 6,4 s totales es lento para un ómnibus acercándose.** El OCR local (CRAFT + CRNN en
  español, ~250 MB) lee en fracciones de segundo y devuelve posición — lo que habilita priorizar
  el más cercano. Recomendación para el tutor: detección + OCR preentrenados como camino primario,
  VLM como comparación. Es la arquitectura de la tesis sin pagar el entrenamiento.
- En el camino, dos incidentes con moraleja: la app llegó a ~10 GB porque cada elección de archivo
  copiaba el modelo sin borrar el anterior (ahora guarda uno solo y muestra diagnóstico antes de
  cargar), y declarar `expo-file-system` rompió el arranque con un símbolo faltante — el árbol de
  dependencias estaba atrasado respecto del SDK y hubo que realinearlo entero.
- Síntesis para el equipo en `docs/spike-vision-local.md`; ADR 0004 actualizado.

## 2026-08-18/19 — Reinstalación por caducidad del provisioning (los 7 días)

- **La app caducó a los 7 días y se reinstaló en el iPhone**, esta vez en **Release** (bundle
  embebido: funciona sin Metro ni Mac). Lección nueva para `dev-build-ios.md`, pendiente de anotar
  ahí: cuando el perfil ya venció, el `xcodebuild` que lanza `expo run:ios` **no lo regenera** —
  hay que compilar una vez con `xcodebuild -allowProvisioningUpdates` y recién después instalar.
- El incidente de TCC de macOS ocurrió **por tercera vez** (18/07, 10/08, 21/08), mismo síntoma y
  misma salida documentada.

## 2026-08-22 — Reunión de equipo: pipelines por caso de uso, botones, y cómo se mide

Las decisiones salieron de la reunión de equipo del 2026-08-21; hoy quedaron escritas.

- **Bondis → camino local** (la latencia manda): detección **preentrenada en la Coral TPU** del
  dispositivo → recorte del banner → OCR sobre el recorte. La TPU pasa de "correr los modelos
  completos" a **preprocesadora** — al celular llega el recorte, no el frame, y el OCR deja de
  distraerse con matrículas. **ADR 0006** (Proposed, a validar con tutor).
- **Supermercado → LLM con visión, elección pendiente** (la complejidad manda): Gemma 3 1B local
  (~700 MB) vs. Gemini Flash nube, con la restricción dura de que sea **gratuito para el usuario**
  — exigir credenciales propias rompe la accesibilidad. Lo destraba medir Gemma 3 1B con visión
  sobre productos reales. También en ADR 0006.
- **La precisión se mide con datasets de evaluación**: esperado vs. obtenido → recall, precision,
  accuracy, F1. Nada se entrena — los modelos vienen preentrenados, y la tarea B1 del roadmap
  cambió de "entrenar" a "evaluar".
- **Botones físicos y modos de operación** (**ADR 0007**, Proposed): 1 click = modo ómnibus,
  2 clicks = modo supermercado, click largo = esperando. Nunca audio no solicitado. Primer
  diagrama del repo (mermaid, canónico en `docs/architecture/README.md`).
- **Documentado de punta a punta**: `docs/pruebas-y-decisiones.md` nuevo — todo lo probado (nube,
  LiteRT-LM, ExecuTorch, OCR) con números, pros/contras y trazabilidad a ADRs; es el **borrador de
  la sección homónima del documento principal de la tesis**. ADR 0004 actualizado (el runtime se
  resuelve por caso de uso). La skill `virovision` realineada entera (ml, hardware, app,
  decisiones, SKILL.md) — era la memoria que un agente nuevo lee primero y contradecía lo decidido.

## 2026-08-23 — Los modos de operación llegan a la app

Lo decidido el 21/08 (ADRs 0006 y 0007), implementado en Inicio.

- **La máquina de estados de ADR 0007, en código** (`features/reader/modes.ts`): esperando /
  modo ómnibus / modo supermercado, con los gestos del botón físico (click, doble click, click
  largo) como transiciones. Sin salto directo entre modos — igual que el diagrama canónico, y con
  un test por cada celda de la tabla porque el firmware va a implementar la misma máquina.
- **Inicio deja los "caminos" del spike y pasa a modos**: dos botones que mutan entre activar y
  desactivar (uno que muta, no dos que se intercambian — VoiceOver no pierde el foco), el modo
  visible también como texto, y cada transición anunciada por voz (ADR 0007: el usuario no tiene
  otro indicador de estado).
- **Ómnibus corre siempre local** (OCR, sin red); **supermercado estrena su camino real**:
  `services/vision/reconocerProducto.ts` — el candidato nube de ADR 0006 (Gemini Flash, prompt y
  schema de producto compartidos con el candidato local para que la comparación mida el modelo).
  Con clave va a la nube; sin clave, o si la nube falla con el modelo local ya cargado, degrada a
  Gemma vía ExecuTorch avisando. La cuota agotada no degrada: se resuelve esperando y se dice
  cuánto.
- **Los errores tipados de visión se mudaron a `errors.ts`**: el camino de producto los necesita
  y no debía importar `benchmark.ts`, que la regla de frontera reserva a instrumentación.
- En el camino se **rescataron dos ramas huérfanas sin PR** (`feat/lector-en-inicio`, que los ADRs
  ya citaban como existente, quedó incluida acá; `docs/decisiones-equipo-2026-08` salió como PR
  #18) y quedó como regla de la skill + memoria: **todo trabajo nuevo arranca en su feature
  branch, antes del primer edit**.

## 2026-08-29 — Apple Developer Program y el camino a TestFlight

- **El Apple ID del proyecto entró al Apple Developer Program** (cuenta Individual: cubre
  ViroVision y cualquier otra app del mismo ID; el team `VPNXQ8K2P8` se conserva). Se termina la
  caducidad de 7 días y los reinstalados por cable: el canal pasa a ser **TestFlight** — builds de
  90 días, testers internos sin revisión (por invitación) y externos por link (el primer build de
  cada versión pasa por Beta App Review).
- **Sin EAS, a propósito.** Se había empezado a preparar EAS Build + Submit y se descartó al
  preguntarnos para qué: TestFlight es de Apple y Xcode hace todo (firma, certificado de
  distribución, subida). EAS agregaba otra cuenta, otro servicio y un cupo de builds a cambio de
  compilar sin Mac, que hoy no hace falta. Los perfiles quedan en `eas.json`, gateados, por si
  algún día sí.
- **`scripts/testflight.sh` (`npm run ios:testflight`)**: archive Release + export
  `app-store-connect` + subida con API key de App Store Connect si está en el entorno; sin key,
  deja el `.ipa` para el Organizer. Build number = fecha-hora, para no commitear un contador.
  `dev-build-ios.md` (sección TestFlight con la tabla internos vs. externos), `ci-cd.md`,
  `PROJECT-STATUS` y la skill actualizados.
- **Pendiente del lado de Apple** (web, una vez): crear la app en App Store Connect y la API key;
  después la primera subida y los testers.
- Del 23/08 quedó un dev build Release compilado pero sin instalar (el iPhone se bloqueaba a mitad
  del montaje de la imagen de desarrollo — `kAMDMobileImageMounterDeviceLocked`); con TestFlight
  deja de importar.

## 2026-08-29 (cont.) — Primer build en TestFlight y la pipeline

- **Primer build subido** con `scripts/testflight.sh` + API key de App Store Connect. Dos
  tropiezos con moraleja: la key tiene que ser rol **Administración** (con Gestor de apps la
  firma de distribución falla: `Cloud signing permission error`), y Expo escribe `CFBundleVersion`
  como literal, así que el build number se fija con PlistBuddy y no por build setting (la primera
  subida salió como "1"). `app.json` declara `ITSAppUsesNonExemptEncryption=false`.
- **Distribución sin agregar testers a mano**: grupos externos con **link público** — *Testers
  ViroVision* (oficial, `main`) y *Beta ViroVision* (features desde una rama). Precio: cada build
  pasa por Beta App Review (el primero de la 1.0 quedó `WAITING_FOR_REVIEW`; los siguientes se
  aprueban en minutos). Contacto, descripción beta y "qué probar" cargados por API.
- **Pipeline**: `.github/workflows/testflight.yml` en runner macOS (gratis, repo público): prebuild
  → archive → subida → `scripts/testflight-distribute.mjs` (espera el procesamiento, asigna al
  grupo, envía a revisión). `scripts/asc.mjs` es el cliente de la ASC API sin dependencias (JWT
  ES256 con `node:crypto`). Secrets y variables del repo espejan el `.env` local.
- Se descartó EAS para esto (PR #21 cerrado, PR #22 mergeado): TestFlight es de Apple y Xcode
  hace todo; EAS sumaba cuenta, servicio y cupo sin necesidad.

## 2026-08-30 — Dos ramas, dos apps: `staging` → ViroVision β, `main` → oficial

- **Decisión de release process**, después de darle vueltas a tres modelos (main→beta +
  promover; probar desde el PR; rama staging): el equipo quiere **la versión en prueba y la
  oficial instaladas a la vez** en el teléfono, y eso fija el diseño — iOS no instala dos builds
  del mismo bundle, así que la β es **otra app para Apple**: `com.virovision.app.beta`,
  "ViroVision β", ícono con franja BETA (`app.config.js` con `APP_VARIANT=beta`, todo lo demás
  heredado de `app.json`). Bundle ID registrado por API; la app β en App Store Connect la crea el
  usuario (Apple no lo permite por API).
- **Ramas**: `staging` pasa a ser la rama por defecto — todos los PRs van ahí y cada merge publica
  la β; `main` es producción y sólo recibe PRs `staging → main` (el release), que publican la
  oficial. Lo que no va a producción se revierte en `staging` con un PR de revert, no a mano.
- **Pipeline**: `testflight.yml` resuelve la variante por rama (o por input en manual), corre lint
  + typecheck + tests antes de compilar, y los scripts descubren el workspace y el bundle según la
  variante. CI acepta PRs a `staging` y a `main`. Convenciones, skill y memoria pasan de "desde
  `main` al día" a "desde `staging` al día".
- **Marcha atrás con la app aparte, a tiempo.** Al preguntarnos para qué era el bundle `.beta`
  quedó claro: sólo para tener β y oficial instaladas a la vez, y con tres devs alcanza con cambiar
  de build desde TestFlight. Queda **una sola app y dos grupos**: `staging` → grupo **interno**
  *Equipo ViroVision* (usuarios de App Store Connect, sin revisión, minutos); `main` → grupo
  externo *Testers ViroVision* con link público. `app.config.js` y el bundle `.beta` quedan
  reservados, documentados como descartados. "Promover a producción" = PR `staging → main`.
- **Beta App Review del build 1 (oficial)**: sigue `WAITING_FOR_REVIEW` desde el sábado; vigía
  activo.

## 2026-08-30 (cont.) — Android por Google Play, mismo patrón

- **Francisco tiene Android**, así que el camino de TestFlight se espeja: `staging` → *internal
  testing* (sin revisión, minutos), `main` → *closed testing* con link de opt-in. Google Play
  Console cuesta USD 25 una sola vez; la restricción de 12 testers × 14 días sólo aplica a
  producción.
- **Sin Java en el Mac**: la upload key se generó con `openssl` como PKCS12 (Gradle la acepta;
  válida hasta 2056) y el build corre sólo en el runner Linux. `scripts/play.sh` inyecta la firma
  por `android.injected.signing.*` (sin tocar build.gradle) y fija `versionCode` = minutos desde
  1970; `scripts/gplay.mjs` sube por la Google Play Developer API con service account (JWT RS256
  en `node:crypto`, sin dependencias). Workflow `android-play.yml` gateado con `PLAY_ENABLED`
  hasta que exista la cuenta.
- Quedó también un **prompt reutilizable** del flujo TestFlight (interno/externo, un build por
  grupo, trampas de permisos y del parser de GitHub) para replicarlo en otro proyecto.

## 2026-08-30 (cont.) — Cierre del spike: un solo runtime, supermercado en la nube

- **Decisión**: ómnibus = OCR local sobre el banner que YOLO recorta en la placa (nada más en el
  camino local); supermercado = **nube**, con selector de modelo en Inicio; sin internet o sin clave,
  supermercado **avisa** — excepción acotada a ADR 0001, escrita en ADR 0006 (actualización
  2026-08-30); el fallback local (Gemma 3 1B) queda pendiente de evaluar.
- **El laboratorio del spike se retiró de la app** (LiteRT-LM, Gemma multimodal por ExecuTorch,
  benchmark de nube, sonda de runtime): fuera `features/ondevice`, `features/benchmark`,
  `services/ondevice/{config,probe,runner,executorchLlm}`, `services/vision/{benchmark,stats}`,
  los prompts/schema de ómnibus en la capa de nube, las secciones i18n, el plugin y las dependencias
  `react-native-litert-lm`, `react-native-nitro-modules`, `expo-document-picker`. **Queda un solo
  runtime nativo**: ExecuTorch, sólo OCR. `expo-file-system` se conserva: lo importa el resource
  fetcher del OCR. Antes de borrar, el código quedó preservado en la rama
  `spike/laboratorio-vision-local`, el tag `spike-laboratorio-vision-local-2026-08-30` y el PR draft
  #33 "[NO MERGEAR]".
- **Capa de nube reorientada al producto**: `BuildRequestInput` recibe `prompts` y `schema` (el
  caso de uso los pasa; el proveedor sólo los coloca), `buildProductoRequest` delega en el proveedor
  del modelo, `reconocerProducto` acepta `model` y tira `VisionNetworkError` cuando la red falla; el
  lector anuncia por tipo de error. La regla de lint deja de restringir `services/ondevice` (OCR es
  camino de producto) y explica la frontera con ADR 0001 + 0006.
- Ramas alineadas: release `staging → main` (#32) con la pipeline de Android.

## 2026-08-30 (cont.) — Selector de modelo para supermercado

- **El modelo de nube se elige en Inicio**: `ModelSelector` (modal calcado del selector de tema:
  disparador `button` cuya etiqueta dice qué modelo rige, menú `radiogroup` con `checked`),
  controlado por props para que el hook se testee sin UI. La preferencia se guarda en el teléfono
  (`visionModelPreference`, AsyncStorage) y se **revalida** contra los modelos disponibles del
  build (`resolveProductoModel`): un id guardado de un proveedor sin clave cae al default
  (`gemini-3.6-flash` — Flash, no Lite) en vez de fallar en cada lectura. Sin ninguna clave, el
  selector no aparece y el modo avisa.
- `reconocerProducto` recibe el modelo elegido; mismo prompt y schema para todos los proveedores
  (test lo fija: si divergieran, el selector compararía prompts y no modelos). 131 tests en 11
  suites; primer test de la base sobre AsyncStorage, con el mock oficial.

## 2026-08-30 (cont.) — CLAUDE.md, y la saga de la firma en CI

- **`CLAUDE.md` en la raíz** (PR #37): toda sesión nueva de agente arranca leyendo el contexto
  mínimo y la orden de invocar la skill `virovision`. `convenciones.md` ganó la tabla "Cómo se
  libera" y corrigió el chequeo de squash (apuntaba a `main`; es `staging`).
- **Saga de la firma en CI**, destrabada en cinco pasos con moraleja:
  1. Los builds de `staging` morían a los 30 s con exit 65 **sin causa visible**: el script tiraba
     la salida de xcodebuild (`| tail -3`). Fix: log completo a `build/xcodebuild-*.log` y las
     últimas 80 líneas al fallar (PR #38). *Un pipe a tail no es un log.*
  2. Causa real: **cada runner efímero creaba un certificado de desarrollo nuevo** al archivar con
     firma automática, hasta el tope de la cuenta de Apple ("maximum number of certificates").
     Se revocaron por API los 16 "Created via API"; el del Mac ("Juan Abreu") quedó.
  3. Forzar `CODE_SIGN_IDENTITY="Apple Distribution"` en el archive **no** es la salida: Xcode lo
     rechaza como conflicto con la firma automática (PR #39, revertido en el paso 4).
  4. Camino estándar de CI: **archive sin firmar** (`CODE_SIGNING_ALLOWED=NO`, sólo con API key
     presente) y la firma completa la hace el export con la **distribución cloud** — una sola,
     reusable entre runners (PR #40). El build de validación falló — y destapó el paso 5.
  5. Un archive sin firmar **no registra equipo**, y `exportArchive` con firma automática lo
     deduce del archive: `error: exportArchive No Team Found in Archive`. Fix: el
     `ExportOptions.plist` declara `teamID`, leído del `pbxproj` que genera el prebuild
     (`plugins/withDevelopmentTeam.js`) para que el ID siga viviendo en un solo lugar (PR #42).
     Con eso, **primer run verde de `staging`** (33334223960): archive sin firmar, export firmado
     con la distribución cloud, build en el grupo interno *Equipo ViroVision*.
- Nota de infraestructura: a mitad de la continuación, macOS **revocó el acceso TCC de la sesión
  de agente a `~/Documents`** (EPERM en toda lectura, incluso para las herramientas de archivo).
  Este cierre se escribió vía la API de GitHub, y el monitor de Beta App Review pasó a correr
  desde un tmp con `asc.mjs` bajado del repo (es público y sin dependencias). Si vuelve a pasar:
  re-otorgar en Ajustes → Privacidad y seguridad → Archivos y carpetas.
- El build **oficial** del release (202608301933, post-limpieza del spike) subió bien y quedó en el
  grupo *Testers ViroVision*, a la espera de que Apple libere la Beta App Review del build 1.

## 2026-08-30 (cont. 2) — Tipo + marca, Flash Lite por defecto, y limpieza de UI

- **La lectura de supermercado devuelve `tipo`, `marca` y `detalle` en campos separados**, donde
  antes `producto` mezclaba qué es con de quién es. El motivo no es de modelado: para quien no ve,
  el tipo decide si el producto sirve y la marca sólo cuál de los que sirven, así que separados el
  anuncio puede decir uno aunque el otro no se lea, en vez de perder los dos por un campo que el
  modelo no pudo completar entero. La frase queda "arroz Saman, Blue Patna 1 kg" — lo que más
  discrimina, adelante. Prompt, schema, parser y `frasearProducto` actualizados en bloque.
- **Se midió la latencia real de los Gemini de visión** (foto de un paquete de arroz, contra la API
  real, no contra los docs): `gemini-3.5-flash-lite` **2-3 s**, `gemini-3.5-flash` **17-30 s**,
  `gemini-3.6-flash` —el default hasta hoy— **34-47 s**, `gemini-3.7-flash` timeout / alta demanda.
  Los tres acertaron tipo, marca y detalle, así que la latencia del grande no compraba nada. El
  default pasa a `gemini-3.5-flash-lite` y el selector ofrece **sólo los dos Flash Lite** (el fijado
  y el alias `-latest`): ofrecer un modelo de medio minuto sólo invita a elegirlo.
  **Reserva metodológica**: sostener pedidos satura el tier gratuito y a partir de la tercera lectura
  seguida cualquier modelo salta a 20-80 s — eso es la cuota, no el modelo. El orden relativo entre
  modelos se sostuvo en todas las tandas; las cifras de arriba son de las corridas espaciadas.
- **Bug encontrado y corregido: el proveedor de Gemini ignoraba el `thinking: 'off'` que recibía.**
  Probando contra la API: `thinking_config`, `thinking_budget`, `reasoning` y `effort` dan 400
  ("Unknown parameter"); el único que existe es `generation_config.thinking_level`, con
  `minimal | low | medium | high`. Ya se manda, junto con `max_output_tokens`. `minimal` lo aceptan
  los Flash Lite y lo **rechazan** los Flash grandes (exigen `low`) — anotado donde hace falta, por
  si alguno vuelve al registro.
- **UI, a pedido del usuario**: se fue el saludo "Hola, <nombre>" del subtítulo de Inicio (nadie lo
  había pedido) y, con él, el campo "Tu nombre" de Ajustes y `services/storage/userName.ts`, que
  existían sólo para alimentarlo. También se fueron el párrafo explicativo de la tarjeta de
  reconocimiento y la tarjeta "Acerca de" de Ajustes.
- **El selector de modelo ahora aparece sólo con el modo supermercado activo**, justo debajo del
  botón que lo habilita: es el único modo que va a la nube, y así el foco de VoiceOver lo encuentra
  en el elemento siguiente. Antes estaba siempre visible para que el orden de foco no cambiara con
  el modo; se cambió a conciencia.
- ADR 0006 lleva una actualización *bis* con la medición y el cambio de default; el índice de
  decisiones de la skill quedó alineado. 138 tests en 11 suites, lint y typecheck en verde.

## 2026-08-31 → 2026-09-01 — el link público quedó vivo (y el fantasma del build 1)

Sesión de operaciones sobre TestFlight, casi toda desde monitores en background:

- **El link público está VIVO.** El release del PR #44 (build 202608312029) pasó Beta App Review el
  2026-08-31: lo envió el propio workflow de `main`, como estaba diseñado. Cualquiera con
  <https://testflight.apple.com/join/jbE7GDqV> instala el release. Con esto el flujo quedó probado
  punta a punta: merge a `staging` → grupo interno en minutos; PR `staging → main` → revisión →
  link público.
- **El fantasma del build 1.** El build 1 (el primero, el del build number roto) fue expirado en
  App Store Connect con su Beta App Review pendiente. Eso canceló la revisión, pero el slot de "un
  build por versión en revisión" quedó ocupado por un fantasma durante horas: la API de lectura
  mostraba **cero** submissions en toda la app mientras `POST /v1/betaAppReviewSubmissions`
  respondía `ANOTHER_BUILD_IN_REVIEW`; dos reenvíos del release anterior (202608301933) llegaron a
  verse `WAITING_FOR_REVIEW` y se evaporaron. Moraleja doble, ahora en `dev-build-ios.md`: no
  expirar un build con revisión pendiente, y consultar el estado **por build**
  (`GET /v1/builds/{id}/betaAppReviewSubmission`) porque el listado con `include` miente mientras
  el backend de Apple converge.
- Quedó una submission `WAITING_FOR_REVIEW` huérfana sobre el build viejo 202608301933: la creó el
  monitor de reintento cuando el slot se liberó, antes de enterarse de que el release nuevo ya
  estaba aprobado. Es inocua; si molesta en ASC, se expira ese build (ya superado).
- **TCC, cuarta vez** (18/07, 10/08, 21/08 y ahora): macOS revocó el acceso a `~/Documents` a mitad
  de sesión. Mismo fix de siempre: Full Disk Access + reiniciar la sesión. Mientras tanto se
  trabajó igual: el cierre anterior se escribió vía la API de GitHub y los monitores corrieron
  desde un tmp con `asc.mjs` bajado del repo (es público y no tiene dependencias).
- **Ciclo de la knowledgebase, ahora explícito en `CLAUDE.md`** (pedido del usuario para no repetir
  contexto entre sesiones): al abrir, invocar la skill `virovision`; al cerrar cada sesión o
  ticket, actualizar SESSION-LOG (siempre), PROJECT-STATUS (si cambió el estado), la skill (si
  cambió cómo se trabaja) y ADRs (si hubo decisión). También quedó escrito que el grupo interno de
  TestFlight no tiene link compartible (convenciones + PROJECT-STATUS).

## 2026-09-01 — El modo supermercado, entero: cámara, cinco modelos y un proxy propio

Punto de partida: un diagrama dibujado por el equipo (`documents/logicas-casos-de-uso.pdf`) con
tres flujos — dos variantes del caso ómnibus según cuánto modelo corre en la Raspi, y el caso
supermercado contra un modelo en la nube. **El camino de ómnibus queda en stand by** por decisión
del equipo: elegir entre sus dos variantes exige tener el hardware para medirlas. La sesión fue
sobre supermercado, que era el que estaba a medio hacer.

Cinco PRs en secuencia, todos con CI verde: **#46** (docs), **#47** (cámara), **#48** (modelos),
**#49** (proxy), **#50** (audio + QA).

- **El diagrama se versiona dos veces, a propósito.** El PDF en `documents/` —carpeta nueva— es el
  registro de qué se acordó; la transcripción a mermaid en `docs/architecture/README.md` es la
  fuente canónica, porque se lee en un diff y GitHub la renderiza. El `documents/README.md` dice
  cuál manda si difieren, que es el costo de tener dos copias.

- **La app abría la fototeca, no la cámara.** Servía para probar pero no era el flujo: en el
  diagrama la foto la saca la placa del dispositivo. Sin hardware, la cámara del teléfono ocupa ese
  lugar y el resto del camino es idéntico. Se usa la cámara del sistema vía `expo-image-picker` y
  no una vista propia con `expo-camera`: la UI nativa ya está resuelta para VoiceOver, y la
  convención prefiere componente estándar bien anotado sobre UI dibujada a mano. La fototeca **no
  se fue**: baja a acción secundaria porque es lo que permite pasarle la MISMA foto a varios
  modelos —si no, la comparación mide fotos y no modelos— y es la salida cuando el permiso de
  cámara quedó denegado.

- **El permiso se pide explícitamente**, en vez de dejar que `launchCameraAsync` falle solo. Sin
  eso el botón no hacía nada visible y quien no ve la pantalla no tenía forma de saber por qué. El
  error tipado lleva `canAskAgain` porque **cambia el consejo**: decirle "aceptá el permiso" a
  quien iOS ya no le va a mostrar el diálogo lo deja esperando un cartel que no aparece.

- **La foto se subía entera.** ~4000 px y varios MB de base64 cruzando el puente JS, la red y los
  tokens de entrada — tres veces latencia para alguien parado frente a la góndola. Ahora se achica
  a 1024 px de lado mayor. El detalle que importa: se restringe el lado **mayor** y no el ancho,
  porque un envase en la góndola es vertical y fijar el ancho dejaba el alto en ~1365 px, que era
  justo lo que se quería evitar. Y el base64 se pide **después** del achique, no antes.

- **Cae la gratuidad como restricción del proyecto** (sigue vigente para el usuario final). El
  selector pasa a cinco modelos elegidos por latencia: `gemini-3.5-flash-lite` (default),
  `gpt-5.6-luna`, `claude-haiku-4-5`, `qwen/qwen3.8-27b` sobre Groq, y el modelo hosteado en
  Arnaldo Castro, **documentado y sin implementar** porque no hay endpoint.

- **Un módulo cubre dos proveedores.** OpenAI, Groq y cualquier vLLM hablan el mismo dialecto, así
  que `providers/openaiCompatible.ts` se parametriza por URL. Es también por qué sumar el endpoint
  de Arnaldo Castro va a ser configuración y no código.

- **El razonamiento, de nuevo.** `gpt-5.6-luna` razona en `medium` por defecto: sin
  `reasoning_effort: 'none'`, tres campos cortos se pagarían como decenas de segundos — la misma
  trampa que en Gemini con `thinking_level`. Quedó anotado que los valores **no** coinciden entre
  proveedores (OpenAI acepta `none|low|medium|high|xhigh|max`, Groq sólo `none|default`) para que
  nadie copie la línea a un modelo que la rechace.

- **De Groq va el Qwen 3.8 y no el 3.6, aun siendo el 3.6 más rápido** (500 contra 450 tok/s). El
  3.6 sólo admite `json_object`, que garantiza JSON sintáctico pero deja los nombres de campo a
  criterio del modelo: `parseProductoLeido` rebotaría una lectura correcta por venir como
  "producto" en vez de "tipo". El 3.8 admite `json_schema` con `strict`. Sobre ~50 tokens de
  respuesta, 50 tok/s son centésimas; la garantía de forma vale más.

- **Salen `gemini-flash-lite-latest` y `claude-opus-5` del selector.** Con los nuevos serían siete
  opciones en un radiogroup que se recorre con VoiceOver, y cada opción de más es un swipe más
  entre la persona y la lectura. Hay un test que **falla** si alguien vuelve a poner dos modelos
  del mismo proveedor: la decisión hay que rediscutirla, no ajustarla.

- **El limitador de cuota imponía el tier gratuito de Gemini a todos.** Pasa a ser por proveedor;
  en los pagos el número alto es deliberado, porque ahí deja de ser la pared del tier gratuito y
  pasa a ser un freno contra un bucle que queme crédito. De paso apareció un bug latente: el
  callback `onWait` existía desde el principio y **no lo llamaba nadie**, así que la app podía
  dormir hasta un minuto en silencio — para quien no ve la pantalla, indistinguible de estar
  colgada. Ahora se anuncia.

- **ADR 0008: un proxy propio, y por qué Supabase.** `EXPO_PUBLIC_*` no es una variable de entorno
  que el binario lea al arrancar: es una constante compilada dentro del `.ipa`, y un `strings` la
  devuelve. Con el tier gratuito era una molestia; con link público de TestFlight vivo y modelos
  pagos, es la tarjeta del proyecto. El ADR compara las cinco opciones evaluadas —Supabase Edge
  Function, Cloudflare Workers, AWS Lambda, VM self-hosted, seguir sin proxy— con el veredicto de
  cada una. Gana Supabase por encaje, no por ser la mejor herramienta: ya es el backend declarado
  (ADR 0002) y ya es dependencia, así que no suma una cuenta más que mantener; Cloudflare es
  técnicamente mejor proxy pero su ventaja (cold start de decenas de ms) es ruido frente a los 2-3
  s del modelo; Lambda es desproporcionado para reenviar un POST. **Cierra el pendiente (b) de ADR
  0006**, abierto desde el 30/08.

- **El proxy es tonto a propósito**, y eso es la decisión, no un atajo. Recibe el cuerpo que el
  módulo del cliente ya armó, le pone la clave y devuelve el body upstream sin tocarlo. Así la
  lógica de proveedor no se duplica del lado del servidor y agregar un modelo sigue siendo un
  cambio en la app. Y reenviar sin leer no es sólo simplicidad: leer para reemitir obligaría a
  duplicar el parseo de eventos de cada proveedor **y mataría el streaming**.

- **La guarda central es la allowlist por host.** Un proxy que reenvía a la URL que le pasen le
  entrega la clave al primero que pida un redirect a su propio servidor. Se valida por host y no
  por URL exacta para que el path lo siga eligiendo el módulo del cliente — y eso resultó tener un
  rédito que no estaba planeado: la síntesis de voz del PR #50 pasa por el mismo proxy **sin tocar
  el servidor**, porque `/v1/audio/speech` está en `api.openai.com`, que ya estaba en la tabla.

- **Queda escrito qué compra el proxy y qué no**, en el código y en el ADR, porque es fácil creer
  que resuelve más de lo que resuelve. No está autenticado: la app no tiene login y la anon key
  viajaría igual en el bundle, así que exigirla sería una indirección, no una defensa. El endpoint
  **es abusable**. Lo que cambia es el modo de falla: la clave se rota o se corta en segundos en
  vez de exigir publicar una versión y esperar revisión de tienda. Las defensas reales son la
  allowlist, el freno por IP —un badén y no una pared, porque cada isolate cuenta lo suyo— y el
  tope de gasto en cada proveedor.

- **El archivo de audio se construyó pero salió apagado**, y vale registrar la objeción porque es
  una decisión sobre la feature tal como estaba pedida: hoy nada lo consume —el hardware no
  existe— así que prenderlo es pagar una llamada al TTS por cada lectura para producir algo que
  nadie abre; y cuando el hardware exista puede que no haga falta, porque un MP3 de ~3 s son ~12
  KB, que por WiFi es nada pero por GATT es del orden de segundos, y quizá convenga que la Raspi
  haga su propio TTS y sólo reciba el JSON — que es exactamente lo que **ADR 0003** tiene
  reservado. Se prende con `EXPO_PUBLIC_AUDIO_FILE_ENABLED=1`.

- **Se descartaron dos TTS antes de elegir el tercero.** Google Cloud TTS: una clave de AI Studio
  no tiene esa API habilitada (son proyectos distintos), así que la clave que ya teníamos no
  servía. TTS nativo de Gemini: devuelve **PCM crudo**, no MP3, y habría que armar el header WAV a
  mano en React Native. Queda `gpt-4o-mini-tts`, que devuelve MP3 directo con la clave que el
  selector ya necesita.

- **El anuncio no puede depender de la red, y ahora el linter también lo dice.** La síntesis se
  llama **después** de `announce()`, sin `await` en el camino crítico, y traga sus errores: si
  falla, el usuario ya escuchó el producto. `features/audio/` pasa a tener prohibido importar
  `@/services/cloud` además de `@/services/vision`, por el mismo motivo de ADR 0001. El transporte
  se movió de `services/vision/` a `services/cloud/`: no es de visión, y hacer que
  `services/audio` dependiera de `services/vision` habría sido una dependencia inventada entre dos
  cosas que sólo comparten el transporte.

- **`docs/qa-modo-supermercado.md`**: 12 bloques partidos por qué necesita cada uno, porque buena
  parte se prueba hoy con la clave de Gemini y el resto depende de cosas que se hacen una vez. Los
  pasos 8 y 9 no son sólo QA: son la corrida que alimenta el **dataset de evaluación** de la tesis
  (la misma foto contra los cuatro modelos, desde la fototeca, anotando `tipo`/`marca`/`detalle`
  por separado).

- **Deuda consciente, anotada en el paso 8 del QA**: los proveedores de OpenAI y Groq están
  escritos **contra los docs, no contra la API real**, porque no hay claves todavía. Esta base
  tiene el estándar contrario a propósito — el de Gemini está verificado contra la API, y por eso
  encontró que el discriminador es `event_type` y no `type`, algo que los docs no dicen y que
  descarta todos los eventos en silencio. Hay cuatro cosas concretas por confirmar.

## 2026-09-02 — Medir cambió dos decisiones (y encontró tres bugs que no se veían)

Con las claves de OpenAI y Groq cargadas, se saldó la deuda del PR #48: los proveedores nuevos
estaban escritos **contra los docs**, que es lo contrario del estándar de esta base. Dos PRs:
**#52** (los arreglos) y **#53** (el selector nuevo y la documentación).

- **El arnés usa el código de la app, no una réplica.** Importa `buildProductoRequest`,
  `readEvent` y `parseProductoLeido` de `services/vision/` y sólo reemplaza el transporte
  (`node:https`, porque el `fetch` global de jest-expo está mockeado y devolvía respuestas vacías
  en 1 ms). Una réplica mide la réplica; lo único que detecta que un proveedor no se comporta como
  su documentación es ejercitar el código que va a correr.

- **Los tres proveedores andan y los tres aciertan**: 15/15 corridas con `tipo`, `marca` y
  `detalle` correctos. La precisión **no** separó a los modelos en esta tarea. Con la salvedad
  grande de que la imagen es sintética y de alto contraste — el mejor caso posible.

- **Lo que separa es la dispersión, no la mediana.** `qwen/qwen3.8-27b` 846 ms (rango 764-1087),
  `gpt-5.6-luna` 1668 ms (1410-2490), `gemini-3.5-flash-lite` 10 649 ms (**2820-32 586**). Once
  veces y media entre el mejor y el peor caso de Gemini, con la cuota fresca y las corridas
  espaciadas. En una app cuya interfaz es la voz la varianza pesa más que la media: el usuario no ve
  una barra de progreso y no puede distinguir "está pensando" de "se colgó". Gemini sale del
  selector.

- **La medición del 30/08 estaba mal reportada, y es la lección metodológica de la sesión.** Había
  dado 2-3 s para Gemini; los extremos de ahora contienen ese número, así que con pocas muestras
  cayó en el extremo bueno y se reportó como si fuera el comportamiento. Queda escrito en la skill
  porque aplica a todo lo que se mida en esta tesis: **cinco corridas y no una, y se reporta el
  rango, no el mejor número.**

- **El default es Luna y no Groq, aunque Groq gane por 800 ms.** La cuota gratuita de Groq limita
  por **tokens** por minuto (8000 TPM, ~1974 por foto a tarifa plana) = ~4 lecturas, y alguien
  recorriendo una góndola hace 2-4. Un default que choca el límite a la cuarta lectura es peor
  producto que uno 800 ms más lento. Groq queda de segunda opción, que es donde su perfil rinde.

- **La gratuidad de ADR 0006 se sigue cumpliendo, que es lo que importa**: es gratuito *para el
  usuario*. Paga el proyecto y mil lecturas cuestan menos de USD 0,50. Lo que ya no hay es un
  default con tier gratuito; el camino gratis existe y es Groq.

- **Tres bugs que sólo aparecen midiendo, ninguno con error visible.** (1) La cuota **no siempre
  llega como evento SSE**: Groq la devuelve como HTTP 429 antes de abrir el stream, y por ese
  camino la app lanzaba `VisionHttpError` — el usuario escuchaba "La nube no respondió" en vez de
  "Cuota agotada, reintentá en N s", con el dato de cuánto esperar llegando y nadie leyéndolo. Es
  el mismo bug que los errores tipados de esta base existen para evitar, repetido en otro camino.
  (2) El tope del limitador para Groq estaba en 25/min, el número de un límite por requests que ese
  proveedor **no tiene**: nunca frenaba, y la tercera lectura seguida daba 429 — pasó en vivo
  durante la campaña. (3) Apagar el razonamiento **no compra latencia fuera de Gemini**.

- **Una justificación mía era falsa, y quedó corregida en el código.** El comentario de
  `reasoning_effort` decía que sin apagar el razonamiento la lectura pasaría a decenas de segundos.
  Eso está medido y es cierto **en Gemini**; acá lo extrapolé. Sobre `gpt-5.6-luna` da igual `none`
  (1,5-2,1 s), `medium` (1,5 s) o no mandar nada (2,0 s), con los mismos 35 tokens de salida: no
  gasta razonamiento en tres campos cortos. Se sigue mandando `none` por intención y porque es
  gratis, pero el comentario ahora dice la razón verdadera.

- **La documentación de Groq tampoco lista sus valores reales**: documenta
  `reasoning_effort: none | default` y `low` respondió 200. Tercer caso que respalda la regla de
  verificar contra la API.

- **El techo de 1024 px es correcto, pero no por lo que estaba escrito.** Se midió con cuatro
  tamaños sobre Luna: los tokens de entrada escalan (346 → 577 → 1138 → 2290) pero las medianas de
  tiempo **no ordenan** — 640 px salió más lento que 1536 px. A esta escala la latencia la dominan
  el modelo y la red, y el ruido entre corridas (±800 ms) tapa la diferencia. El techo se mantiene
  porque baja el costo a la mitad y el tráfico, no porque compre segundos.

- **`docs/mediciones/`, carpeta nueva.** Los datos crudos y el método, un archivo por campaña, con
  una regla escrita: **una campaña no se edita después de corrida; si se vuelve a medir, es un
  archivo nuevo.** Los números viejos son el registro de qué se sabía cuándo, y borrarlos hace que
  las decisiones tomadas con ellos parezcan arbitrarias. El análisis y la decisión siguen en
  `pruebas-y-decisiones.md`, que es el borrador de la sección de la tesis, y linkean los datos en
  vez de duplicarlos.

- **Los modelos retirados no se borran**: viven en `PERFILES_RETIRADOS` con la medición que los
  descartó, y sus proveedores siguen implementados y testeados. Volver a ofrecer uno es mover una
  entrada de lista, y hay tests que fallan si alguien lo devuelve copiándolo en vez de moviéndolo o
  si se borra el módulo de un proveedor retirado.

## 2026-09-02 (cont.) — El proxy desplegado, y dos fallos que enseñaron dónde no mirábamos

Segunda mitad del día: PRs **#55** a **#57**. Termina con **el primer build de ViroVision que sale
sin ninguna clave adentro**, verificado funcionando en el teléfono.

- **Un build salió con el modo supermercado muerto y nadie se enteró.** Al sacar Gemini del
  selector (#53), el único secret de proveedor del repo dejó de corresponder a un modelo del
  registro: `availableModels()` quedó en vacío. La app degradó como debía —dijo "no configurado" y
  el modo ómnibus siguió leyendo— **y ahí está la trampa**: la degradación elegante es correcta en
  runtime y es un problema en el pipeline. Un build que no puede cumplir la mitad de su función no
  debería tardar media hora en decirlo, ni exigir que alguien lo abra para descubrirlo.

- **`verificar-claves.mjs` compara lo que efectivamente se desincronizó**: los proveedores que el
  *registro* ofrece contra las claves que el *entorno* trae. Chequear "¿hay alguna clave?" no habría
  detectado nada, porque la de Gemini estaba ahí — faltaba una clave de un proveedor *que siguiera
  en la lista*. Por eso lee `MODEL_PROFILES` y no `PERFILES_RETIRADOS`. Corre antes del build y
  falla en segundos. **Se verificó reproduciendo el fallo real**: el run del PR #55 falló en ese
  paso, con el mensaje que nombra el arreglo.

- **La regla que faltaba, escrita**: una clave **gratuita** sin tarjeta puede ir al bundle; una
  **paga**, no. No es un permiso a medias: el peor caso de que roben una gratuita es que quemen una
  cuota que se repone sola, y el de una paga es la tarjeta del proyecto. Tratarlas igual sólo
  lograría que no hubiera modo supermercado en ningún build distribuible hasta que el proxy
  existiera. Con el proxy activo la regla deja de importar, porque no viaja ninguna.

- **El proyecto de Supabase ya existía**, desde el 18/07, creado para la capa de cuenta de ADR 0002
  y nunca usado: **0 usuarios, 0 tablas, 0 buckets**. Estaba pausado por inactividad.
  `PROJECT-STATUS.md` lo daba por inexistente. No hubo nada que borrar; se despausó y se usó para
  el proxy.

- **El proxy quedó desplegado y verificado con la clave del cliente en vacío**, que es la prueba de
  que la pone el servidor. Las cuatro guardas responden (destino ajeno 400, proveedor inexistente
  400, método ≠ POST 405, `http://` sobre host válido 400). El costo es despreciable: Qwen pasa de
  846 a ~950-1070 ms y Luna se mantiene dentro de su varianza. **Era la apuesta de que fuera un
  pasamanos y no interpretara la respuesta, y se sostiene.**

- **Riesgo operativo nuevo: el tier gratuito pausa el proyecto** tras una semana sin actividad, y a
  éste ya le había pasado. Con el proxy en producción y sin claves en el bundle, una pausa deja sin
  modo supermercado a todos los builds a la vez. Y lo que el usuario escucharía es *"sin conexión a
  internet"*, que es engañoso: conexión hay, el que no está es el proxy. **Distinguir los dos casos
  quedó pendiente y ahora pesa más que antes.**

- **Un test mío medía el entorno, no el código.** `sintesis.test.ts` afirmaba "sin proxy sale
  directo a OpenAI" leyendo el proxy del entorno: pasaba en local —jest no carga `.env`— y falló en
  el job de publicación, donde la variable sí está. La causa de fondo vale más que el bug: **el CI
  de PRs corre los tests sin secrets y el workflow de publicación los corre con todos en el `env`
  del job**. Son dos entornos distintos ejecutando la misma suite, y lo único que evita que eso
  muerda es que los tests no dependan del ambiente. El proxy pasó a ser inyectable, mismo criterio
  que el reloj del limitador de cuota, y de paso el test cubre los dos caminos en vez de asumir uno
  — incluido el que importa: que con proxy **la clave no viaja**.

- **Nota operativa de un error propio**: `supabase projects api-keys` imprime la `service_role` en
  claro, que es la clave que saltea RLS. No correrlo en un log ni en una sesión compartida. Se
  resolvió rotando el JWT secret (barato: la app no usa ninguna de las dos claves y el proxy corre
  con `verify_jwt = false`) y apagando el signup por email, que no usamos y dejaba un endpoint
  abierto para crear usuarios — verificado desde afuera: `Signups not allowed for this instance`.

- **Verificado en el teléfono.** Build `202609021823`, `VALID` en el grupo interno. El modo
  supermercado funciona de punta a punta contra el proxy, sin ninguna clave en el binario.

## 2026-09-04 — El selector de modelo se muda a Ajustes

- **El selector del modelo de supermercado ahora vive en Ajustes**, no en Inicio. Elegir el modelo
  es un ajuste: se toca una vez y no en cada lectura, y en Inicio competía por atención con la
  acción principal. En Ajustes va **sin rótulo ni texto alrededor** (pedido explícito): el
  disparador ya se anuncia como *"Modelo seleccionado: <modelo>"* y el menú como *"Seleccionar
  modelo"*, así que un encabezado repetiría lo que el lector de pantalla ya dice.

- **El hook `useModeloSupermercado` pasó a ser `ModeloSupermercadoProvider`**, montado en el layout
  raíz. No es refactor de gusto: con el selector en Ajustes y la lectura en Inicio, dos instancias
  del hook habrían tenido cada una su `useState`, y elegir un modelo en Ajustes **se vería aplicado
  sin estarlo** hasta remontar Inicio. El storage y el resolver (`modeloSupermercado.ts`) no se
  tocaron, tal como anticipaba el comentario del propio hook.

- **En Inicio quedó el aviso de "sin clave configurada"**, sólo con el modo supermercado activo. Se
  dice antes de leer y no al sacar la foto, y sigue valiendo la regla de accesibilidad: el estado no
  se comunica por un control ausente. El aviso también aparece en Ajustes, donde ahora es el lugar
  donde el usuario va a buscar el control que no está.

- Verificado: `npm run lint`, `npm run typecheck`, `npm test` (178 tests). Actualizados
  `PROJECT-STATUS.md` y el recorrido de VoiceOver de `qa-modo-supermercado.md`, que apuntaba
  explícitamente a que el selector estaba en Inicio "y no en Ajustes".

## Open threads / next

Ordenado por lo que destraba cada cosa. Lo de arriba es lo que más rinde tomar primero.

### Lo más valioso que falta
- **Dataset de evaluación con fotos reales de góndola.** Todo lo medido el 2026-09-02 usa una imagen
  sintética de alto contraste: es el piso de dificultad, y **los aciertos de ahí no son la precisión
  del sistema**. Protocolo escrito en los pasos 8 y 9 de `qa-modo-supermercado.md`.
- **Validar ADR 0006, 0007 y 0008 con el tutor** — 0006 y 0007 siguen en Proposed.

### Deuda técnica conocida
- **El error de proxy caído dice "sin conexión a internet"**, que es mentira: conexión hay, el que
  no está es el proxy. Pesa más desde que el proxy es punto único de falla del modo supermercado.
  Arreglo chico.
- **`claude-haiku-4-5` sin verificar** contra su API: requiere tarjeta.
- **Fallback local de supermercado**: evaluar Gemma 3 1B con visión sobre productos reales, para
  cerrar la excepción a ADR 0001.

### Operación
- **El proyecto de Supabase se pausa solo** tras una semana sin actividad, y con el proxy en
  producción eso deja sin modo supermercado a todos los builds. Usarlo seguido, o **Pro antes de la
  defensa**.
- **Sumar a Magalí a TestFlight** (grupo interno) cuando pase su email; Francisco espera el canal
  Android.
- **Google Play**: cuenta creada y pagada, **verificación de identidad pendiente**; después: crear
  la app (`com.virovision.app`), service account (`PLAY_SERVICE_ACCOUNT_JSON`), `PLAY_ENABLED=true`
  y primera subida manual del `.aab`. Repo listo (`docs/android-play.md`).

### Bloqueado por hardware
- **Camino de ómnibus en stand by** (2026-09-01): los dos casos del diagrama están en mermaid, sin
  implementar. Elegir entre ellos exige hardware con qué medirlos.
- Elegir el **detector para la TPU** y medirlo sobre la RPi Zero 2 W + Coral.

### Suelto
- Reportar el **bug de visión de `react-native-litert-lm`** con el caso reproducible del spike.
