# ViroVision — Mobile App

React Native (Expo) app for ViroVision: it pairs with the glasses-mounted device over BLE, receives
recognition results, and speaks them to the user. **Accessibility is a hard requirement** — the app
targets people with low or no vision, so it is built and tested with VoiceOver / TalkBack in mind.

## Stack

- **Expo SDK 57** · React Native 0.86 · React 19 · TypeScript
- **New Architecture** (JSI / bridgeless) enabled
- **Expo Router** (file-based routing, routes live in `src/app/`)
- **react-native-ble-plx** — BLE (GATT) data/control channel to the device
- **expo-speech** — text-to-speech for auditory feedback
- **expo-audio** — audio playback / (future) routing to the device earphone

> Native modules (BLE) require a **custom dev client** — they do not run in Expo Go. TTS works in
> Expo Go, so the current starting screen (incl. "Probar audio") is fully testable there.

## Getting started

```bash
npm install
npx expo start            # dev server; press i / a, or open in a dev client

# Native modules (BLE) need a dev client build:
npx expo run:ios          # or: npx expo run:android
# or EAS: npx eas build --profile development --platform ios
```

Checks:

```bash
npx tsc --noEmit          # typecheck
npx expo lint             # lint
```

## Project structure

```
src/
  app/                # Expo Router routes: index (Home), connect, settings
  components/         # reusable UI (accessible-button, screen, themed-*)
  constants/          # theme tokens (colors, spacing, Brand, A11y)
  features/
    auth/             # online account layer: session state machine + useAuth (ADR 0002)
    device/           # BLE connection state machine + GATT profile (types, gatt, useDeviceConnection)
    audio/            # auditory feedback (announcer)
    recognition/      # recognition domain model + Spanish announcement formatting
  hooks/              # theme / color-scheme hooks
  i18n/               # Spanish strings (single source for screen-reader labels)
  services/
    ble/              # BleClient interface + stub (real react-native-ble-plx impl TODO)
    audio/            # TTS service (expo-speech); audio-routing to device earphone TODO
    supabase/         # SupabaseAuthClient interface + stub (real @supabase/supabase-js impl TODO)
    storage/          # settings persistence (in-memory stub)
  types/              # public re-exports of core domain types
```

## Architecture: offline core vs. online account layer

Two strictly separated layers (see `docs/architecture/adr/`):

- **Offline core** — recognition (bundled model + local inference), device link, audio feedback.
  Works with **zero internet**; nothing on the recognition path awaits a network call (ADR 0001).
- **Online account layer** — auth (Google via Supabase), profile, settings/history sync, model-file
  updates. Requires internet; degrades gracefully; a signed-in user **stays signed in offline**
  (ADR 0002). Configure via `.env` (see `.env.example`).

## Current status (scaffold)

- ✅ Accessible starting screen (Home) — navigation + working TTS ("Probar audio").
- ✅ Connect screen with a live-region status and the connection state machine.
- 🚧 **BLE/GATT** is a typed **stub** (`services/ble/bleClient.ts`) — reports "not implemented"
  instead of faking success. Wire it against `features/device/gatt.ts` on a dev-client build.
- 🚧 **Audio routing** to the device earphone (separate channel) is a documented TODO in
  `services/audio/tts.ts`.

## Accessibility strategy

Following Mascetti et al. (2020), cross-platform frameworks expose only a subset of native
accessibility. So the app: (1) prefers **standard RN components** correctly annotated with
`accessibilityLabel` / `accessibilityRole` / `accessibilityHint`; (2) avoids highly custom UI;
(3) treats **real VoiceOver/TalkBack testing** and **usability testing with blind users** as
required steps, not assumptions. See `.claude/skills/virovision/references/app.md`.
