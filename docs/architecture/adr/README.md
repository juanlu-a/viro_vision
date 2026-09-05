# Architecture Decision Records (ADRs)

Each ADR captures one significant decision: its context, the decision, and its consequences.
Format: short Markdown, numbered `NNNN-title.md`, status one of Proposed / Accepted / Superseded.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-offline-first-on-device-inference.md) | Offline-first: self-contained, on-device inference | Accepted (enmendado 2026-08-10 — nube como acelerador opcional) |
| [0002](0002-backend-and-auth-supabase.md) | Backend & auth: Supabase as the online account layer | Accepted |
| [0003](0003-enlace-placa-telefono.md) | Enlace placa ↔ teléfono: BLE como plano de control, la foto se decide midiendo | Proposed — a validar con tutor (actualizado 2026-09-05 — medido: 53 KB en 4,5 s por BLE; la foto va por WiFi) |
| [0004](0004-on-device-inference-runtime.md) | Runtime de inferencia on-device (Gemma vía LiteRT-LM) | Proposed (actualizado 2026-08-22 — el runtime se resuelve por caso de uso, ver 0006) |
| [0006](0006-pipelines-por-caso-de-uso.md) | Pipelines por caso de uso: bondis local (TPU preprocesadora), supermercado LLM en la nube | Proposed — a validar con tutor (actualizado 2026-09-01 — cinco modelos, cae la gratuidad) |
| [0007](0007-botones-fisicos-modos-de-operacion.md) | Botones físicos y modos de operación del dispositivo | Proposed — a validar con tutor |
| [0008](0008-proxy-propio-para-claves-de-nube.md) | Un proxy propio para las claves de los modelos de nube | Accepted |

### To backfill (decisions already made in the thesis, not yet written as ADRs)
- Hardware platform: **Raspberry Pi Zero 2 W + Coral TPU + Camera Module 3**.
- Mobile framework: **React Native (Expo)** over Flutter / native.
