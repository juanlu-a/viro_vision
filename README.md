# ViroVision

**ViroVision** is an assistive system for people with **low or no vision** that identifies
**metropolitan bus lines** and **basic-basket supermarket products** and gives **real-time auditory
feedback**. A camera device mounted on the temple of a pair of glasses captures the environment;
a paired mobile app handles connectivity, processing support, and interaction.

Final-career (thesis) project — Ingeniería en Telemática, Facultad de Ingeniería, Montevideo,
Uruguay, 2026. By Juan Lucas Abreu, Magalí Dellapiazza and Francisco Tauber. Director: Ing. MSc.
Sebastián García Parra.

## The two use cases

1. **Bus lines** — recognize the line of an approaching bus (OCR) and announce it, prioritizing the
   most relevant one when several are present.
2. **Supermarket products** — identify basic-basket products and announce them.

## Monorepo layout

| Path | Pillar | What's here |
|------|--------|-------------|
| [`app/`](app/) | **Mobile app** | React Native (Expo) app — BLE link to the device, auditory feedback, accessibility-first UI. |
| [`hardware/`](hardware/) | **Hardware / IoT** | Raspberry Pi Zero 2 W + Coral TPU + Camera Module 3; firmware, BLE peripheral, 3D casing. |
| [`ml/`](ml/) | **ML / OCR / CV** | YOLO11 detection, OCR, Edge AI (TFLite), datasets. |
| [`docs/`](docs/) | **Docs** | Thesis deliverables, architecture, ADRs. |

Deep context for AI assistants lives in the `virovision` skill: `.claude/skills/virovision/`.

## Quick start (app)

```bash
cd app
npm install
npx expo start          # TTS works in Expo Go; BLE needs a dev client (npx expo run:ios / run:android)
```

See [`app/README.md`](app/README.md) for the full app guide.

## Status

- ✅ Monorepo scaffolded; React Native app bootstrapped with an accessible starting screen + working
  text-to-speech.
- 🚧 BLE/GATT communication, device firmware, and the ML models are the next pieces (see each
  pillar's README).

## Constraints & principles

- **Accessibility is a hard requirement** (VoiceOver / TalkBack, real usability testing with blind users).
- **Offline-first / self-contained.** Essential features (detection, OCR, audio feedback) must work
  **without internet** — the recognition model is bundled and runs locally (on the device or on the
  phone), never a cloud API **as the only path** (since ADR 0001 was amended on 2026-08-10 the
  cloud may act as an *optional accelerator*, with local inference as the guaranteed fallback).
  Non-essential features may use the internet.
- **Low cost, portable**, adapted to the Uruguayan context.
- Two device architectures are evaluated: **on-device** processing vs. **offload to the phone**
  (in both, inference stays local).

## Timeline

Development targeted for **~mid-November 2026**; hard deadline **30 November 2026**.
