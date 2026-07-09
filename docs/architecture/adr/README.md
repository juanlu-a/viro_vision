# Architecture Decision Records (ADRs)

Each ADR captures one significant decision: its context, the decision, and its consequences.
Format: short Markdown, numbered `NNNN-title.md`, status one of Proposed / Accepted / Superseded.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-offline-first-on-device-inference.md) | Offline-first: self-contained, on-device inference | Accepted |
| [0002](0002-backend-and-auth-supabase.md) | Backend & auth: Supabase as the online account layer | Accepted |

### To backfill (decisions already made in the thesis, not yet written as ADRs)
- Hardware platform: **Raspberry Pi Zero 2 W + Coral TPU + Camera Module 3**.
- Mobile framework: **React Native (Expo)** over Flutter / native.
- App↔device comms: **two channels** — BLE (GATT) for data/control + a separate audio channel.
