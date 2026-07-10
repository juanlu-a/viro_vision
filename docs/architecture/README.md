# Architecture

System architecture, component and data-flow diagrams, and Architecture Decision Records (ADRs).

_To be populated._ Expected contents:

- **System overview** — app ↔ device ↔ (optional) phone-side processing.
- **App ↔ device integration** — the two channels: BLE (GATT) for data/control + a separate audio
  channel (A2DP/HFP or wired) for the recognition TTS to the device earphone.
- **Recognition data flow** — capture → detection (YOLO11) / OCR → prioritization → announcement.
- **ADRs** — see [`adr/`](adr/). Recorded so far:
  [ADR 0001 — Offline-first: self-contained, on-device inference](adr/0001-offline-first-on-device-inference.md).
  To backfill: RPi Zero 2 W + Coral TPU, React Native (Expo), on-device vs. offload-to-phone.
