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
  caducidad de 7 días y los reinstalados por cable para el equipo: el canal pasa a ser
  **TestFlight** — builds de 90 días, testers internos sin revisión (el equipo) y externos por link
  (Luciano, UNCU; primer build por Beta App Review).
- **Repo preparado para EAS Build + Submit**: `eas.json` con `development` en dispositivo (dev
  client ad-hoc), `development-simulator`, `preview` (simulador) y `production` → store con
  `autoIncrement`; `submit.production` ya lleva `appleId` y `appleTeamId`. El workflow *EAS Build
  (iOS)* suma el perfil `development` y un checkbox *submit* que agrega `--auto-submit`.
  `dev-build-ios.md`, `ci-cd.md`, `PROJECT-STATUS` y la skill actualizados; los límites del
  provisioning gratuito quedan documentados como historia.
- **Pendiente interactivo** (pide logins de Expo y Apple): decidir en qué cuenta de Expo vive el
  proyecto EAS, `eas init`, primer `eas build --profile production`, `eas submit`, y crear la app
  en App Store Connect. Después, `EXPO_TOKEN` + `EAS_ENABLED=true` para los workflows.
- Del 23/08 quedó un dev build Release compilado pero sin instalar (el iPhone se bloqueaba a mitad
  del montaje de la imagen de desarrollo — `kAMDMobileImageMounterDeviceLocked`); con TestFlight
  deja de importar.

## Open threads / next
- **Decidir supermercado**: medir Gemma 3 1B con visión sobre productos reales (el modo ya junta
  evidencia desde la pantalla real); resolver el despliegue de la clave si gana la nube (ADR 0006).
- **Validar ADR 0006 y 0007 con el tutor** — todo quedó en Proposed.
- Armar el **dataset de evaluación** (captura + etiquetado esperado/obtenido) para ambos casos.
- Elegir el **detector para la TPU** y medirlo sobre la RPi Zero 2 W + Coral (riesgo técnico
  abierto del camino de bondis).
- Reportar el **bug de visión de `react-native-litert-lm`** con el caso reproducible del spike.
- Pending interactive setup: **Supabase** project + `app/.env`; **EAS** `login`/`init` + `EXPO_TOKEN` +
  `EAS_ENABLED`; **Apple** Developer account (para escapar de la caducidad de 7 días). See
  `PROJECT-STATUS.md`.
