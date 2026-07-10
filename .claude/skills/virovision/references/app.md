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
to phone" architecture), the recognition model is **bundled into the app and runs on-device** (e.g.
via a local runtime — TFLite / ONNX Runtime / ExecuTorch through a RN native module), **never a
cloud API**. Internet may be used only for non-essential extras (updates, remote config, optional
sync); losing connectivity must never break recognition or the audio response. Practical
implications: bundle model assets in the app, budget app size accordingly, and keep the recognition
→ announcement path free of any network dependency.

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

## Auth / backend (online account layer)
Google login via **Supabase OAuth (web redirect)** is wired in `src/services/supabase/` and
env-gated: with no `EXPO_PUBLIC_SUPABASE_*` vars it falls back to an offline-safe stub; with them set
it does real sign-in (browser → exchange code → AsyncStorage-persisted session that survives offline).
Setup + dashboard config: `docs/supabase.md`. Strictly separated from the offline recognition path
(ADR 0001/0002).

## Scaffold status
Structure + one accessible starting screen only. BLE and audio are typed stubs/interfaces this
pass — no live GATT or routing yet.
