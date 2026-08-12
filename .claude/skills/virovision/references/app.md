# Pillar: Mobile App (React Native)

## Role in the system
The app is the user's control surface and (in one of the two architectures) the processing
backend. It is **not** a conventional app that plays audio through the phone speaker: ViroVision
has its **own physical earphone** integrated in the device, and only the app's recognition TTS
goes there. All other phone audio (calls, notifications, music, the OS screen reader) keeps using
the phone's normal output. This channel separation is itself an accessibility decision — the user
does not have to share one audio channel between the OS screen reader and ViroVision.

## Offline-first (hard requirement)
Essential features must work **without internet**. When the app is the processing backend ("offload
to phone" architecture), the model runs **on the phone's own compute** — "offload to the phone"
means offload to local compute, *not* to a server. The concrete runtime is decided in **ADR 0004**:
**Gemma via LiteRT-LM** (MediaPipe LLM Inference is in maintenance mode; the TFLite / ONNX Runtime /
ExecuTorch options originally listed here are superseded).

**Since the 2026-08-10 tutor meeting, ADR 0001 is amended: the cloud is allowed as an *optional
accelerator*.** A runtime *model gateway* may route an inference to the cloud when there is coverage
and it buys accuracy — the tutor's example is basic-basket products, which tolerate more latency in
exchange for precision. Three constraints survive the amendment and are not negotiable:

1. **Local inference is the guaranteed fallback.** With no internet, recognition and the auditory
   response keep working. Losing connectivity may cost accuracy or latency, never the feature.
2. **Cloud-only recognition, with no local fallback, stays forbidden.** That is the dependency
   ADR 0001 exists to prevent, and the differentiator vs. Seeing AI / Lookout / OrCam.
3. **Latency-critical cases (bus lines) stay local by default.**

The cloud benchmark under `app/src/services/vision/` is **development instrumentation only** and
carries a boundary comment saying so: it must never be called from the camera → detection/OCR →
announcement path. See `references/convenciones.md` for the boundary-rule convention.

## Tooling
- **React Native via Expo** with a **custom dev client** (not Expo Go alone — native modules like
  BLE require a dev/EAS build), TypeScript, **New Architecture on** (JSI / bridgeless).
- **Expo Router** (file-based routing) for navigation.

## Why React Native (from the thesis)
Chosen over Flutter and pure native on four criteria:
1. **Inherited accessibility** — renders real native components, so it inherits much of the OS
   accessibility behavior (VoiceOver / TalkBack) instead of rebuilding it on a canvas (Flutter).
2. **Team velocity** — the team already knows JavaScript/React; no Dart or two native codebases.
3. **Mature hardware-comms ecosystem** — `react-native-ble-plx` / `react-native-ble-manager`
   implement the GATT profile needed to talk to the device.
4. **Production-proven at scale** (Meta/Instagram, Microsoft, Shopify).

## New Architecture (JSI / Bridgeless)
Since 2024 RN replaces the async JSON "bridge" with the **JSI** — JS calls native methods
directly in shared memory, no serialization. Lower latency matters here: the app must react in
near real time to recognition results and drive auditory feedback.

## Accessibility API — the core of the app
Annotate standard components with:
- `accessible` — mark an element (and children) as a single accessible node.
- `accessibilityLabel` — what the screen reader announces (independent of visible text).
- `accessibilityRole` — the element's function (button, image, header…), mapped to iOS
  `UIAccessibilityTraits` / Android roles.
- `accessibilityHint` — extra hint about what interacting will do.

### The Mascetti et al. (2020) caveat — drives the whole app strategy
"Developing Accessible Mobile Applications with Cross-Platform Development Frameworks" (ACM ASSETS
2020, arXiv:2005.06875): cross-platform frameworks expose only a **subset** of native
accessibility; full parity often needs **native modules per platform**. Consequences for
ViroVision:
- **Prefer standard RN components** (`View`, `Text`, `TouchableOpacity`, `Image`, …) correctly
  annotated — they inherit the expected VoiceOver/TalkBack behavior.
- **Avoid / minimize highly custom UI** (hand-drawn graphics, non-standard gestures) — the exact
  weak spot; if unavoidable, implement a targeted native module.
- **Formal accessibility testing** with real VoiceOver (iOS) and TalkBack (Android) is a required
  development milestone, not an assumption.
- **Complement with real usability testing** with blind / low-vision users — a correct API is
  necessary but not sufficient.

## Two communication channels with the device
BLE cannot carry real-time audio (low bandwidth), so the device uses **two channels**:
1. **Data/control — BLE (GATT):** `react-native-ble-plx` (+ its Expo config plugin). Connection
   state, commands, recognition results.
2. **Audio — separate channel:** the TTS/recognition audio to the device earphone goes over a
   Bluetooth Classic profile (A2DP/HFP) or a wired connection (hardware team's decision).

### Audio routing
The app must **explicitly route its output** to the device's audio endpoint instead of the system
default, using each platform's session/routing APIs (`AVAudioSession` on iOS,
`AudioManager`/`AudioDeviceInfo` on Android) or a RN library that exposes output-device selection
(e.g. `expo-audio` / `react-native-track-player`). Full routing is a later task; the scaffold keeps
it as a typed stub.

## Auth / backend (online account layer) — ARCHIVED, app has NO login
Decision (2026-07-20, team + tutor): **the app ships without a login** — it opens directly to the tabs.
The core is offline-first (on-device model + BLE), so accounts add no value; Apple doesn't require a
login. The Supabase email-auth code (`features/auth/AuthContext.tsx`, `src/services/supabase/*`) is
**archived, not deleted** — present in the repo but **not wired into navigation** — kept for a possible
future *optional* sync. If login ever returns it's Supabase **email + password** (never Google/OAuth).
See ADR 0002.

## Estado (2026-08-11)

Ya no es un scaffold. Lo que existe y funciona:

- **Cuatro pantallas** con pestañas **nativas** (`NativeTabs`: Liquid Glass en iOS 26, Material en
  Android) — Inicio, Dispositivo, Ajustes, más una ruta suelta de desarrollo.
- **Design system con tokens verificados por tests.** `constants/theme.ts` + `theme.test.ts`
  comprueban contraste WCAG en los dos temas; ya atajó tres regresiones invisibles a ojo. Identidad
  aplicada según el manual v1.0 (ver la skill `virovision-marca`), con tipografía de marca embebida
  en el binario.
- **Selector de tema** claro/oscuro/sistema, persistido en AsyncStorage — es una preferencia de
  accesibilidad, así que funciona sin red ni cuenta.
- **Benchmark de latencia contra modelos de visión en la nube** (`services/vision/`), con
  time-to-first-token medido sobre streaming SSE, limitador de cuota y estadística de mediana/p90.
  Es instrumentación de desarrollo, no producto.
- **Corre en un iPhone físico** vía dev build firmado con Apple ID personal — ver
  `docs/dev-build-ios.md`, incluida la caducidad de 7 días.
- **109 tests**, tsc y lint en verde.

Lo que sigue siendo un stub tipado, deliberadamente: **BLE/GATT** (no hay hardware todavía) y el
**ruteo de audio** al auricular del dispositivo. Los dos fallan con un error tipado que dice "no
implementado" en vez de fingir que funcionan.
