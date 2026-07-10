# ADR 0001 — Offline-first: self-contained, on-device inference

- **Status:** Accepted
- **Date:** 2026-07-09
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** ml, app, hardware, requirement

## Context

ViroVision assists people with low or no vision by identifying **bus lines** and **supermarket
products** and giving **real-time auditory feedback**. Its users need it exactly where connectivity
is least reliable: at bus stops, on the street, inside supermarkets. The existing cloud-dependent
tools (Microsoft Seeing AI, Google Lookout, OrCam MyEye) are limited precisely by requiring
permanent connectivity (and, for OrCam, high cost).

The system supports **two architectures** (see the device selection work): (a) process **on the
device** (Raspberry Pi Zero 2 W + Coral TPU), and (b) **offload** image processing **to the phone**.
Architecture (b) creates a real risk: it would be easy to "offload to the phone" and, from there, to
a cloud recognition API — reintroducing the exact internet dependency we are trying to eliminate.

## Decision

**The essential features work offline. Recognition inference always runs locally — never a cloud API.**

1. **Essential path is offline by definition.** Object detection, OCR and the auditory response MUST
   function with **no internet**. Losing connectivity must never break recognition or the audio
   feedback.
2. **Model runs locally in both architectures.**
   - **On-device:** RPi Zero 2 W + Coral TPU via TensorFlow Lite / OpenCV.
   - **Offload-to-phone:** the model is **bundled into the app** and runs through a **local**
     mobile runtime (TFLite / ONNX Runtime / ExecuTorch via a React Native native module).
     "Offload to the phone" means offload to the phone's **local compute**, *not* to a server.
3. **Internet is allowed only for non-essential features** — e.g. app/model updates, remote config,
   optional data sync, analytics. These must degrade gracefully and never sit on the critical
   recognition → announcement path.

## Consequences

**Positive**
- Reliable in low/no-connectivity environments (the actual usage context).
- Lower latency and better privacy (images processed locally, not uploaded).
- Clear product differentiator vs. cloud-dependent assistive tools.

**Costs / constraints this imposes**
- **Model must fit on-device and in the app bundle.** Drives model choice, **quantization** (e.g.
  INT8), and Coral-compilation/TFLite export; app size must be budgeted (bundle vs. download-once-
  and-cache).
- **Runtime choice is constrained:** the phone path needs a local inference runtime + RN native
  module, not a cloud SDK.
- **Accuracy/size trade-off** is tighter than a server would allow — must be validated against the
  device's and phone's compute budgets.
- **Model updates** need an explicit (optional, non-blocking) offline-friendly delivery mechanism.

## Notes / implications for the current code

- The recognition domain model (`app/src/features/recognition/types.ts`) is transport-agnostic: a
  `RecognitionEvent` can be produced by the **device over BLE** *or* by a **local model on the
  phone** — no change needed to support either architecture.
- The BLE layer (`app/src/services/ble/`) carries **results/control only**; it is unrelated to where
  inference runs and does not affect the offline guarantee.

See also: `.claude/skills/virovision/SKILL.md` and `references/app.md`, `references/ml.md`.
