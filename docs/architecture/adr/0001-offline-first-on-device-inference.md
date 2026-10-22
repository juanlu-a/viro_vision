# ADR 0001 — Offline-first: self-contained, on-device inference

- **Status:** Accepted (amended 2026-08-10, see "Update" below; actualización 2026-10-22: sin Coral, supermercado por nube)
- **Date:** 2026-07-09
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** ml, app, hardware, requirement

> **Update 2026-08-10 — cloud as an optional accelerator.** After the tutor meeting on model
> integration and performance (`docs/REUNIONES-TUTOR.md`), point 3 below is relaxed: **the cloud is
> now allowed as an optional accelerator on the recognition path**, with **local inference as the
> guaranteed fallback**. The hard requirement is unchanged — *with no internet, recognition and the
> auditory response keep working*. Concretely:
>
> - A runtime **model gateway** may route an inference to the cloud when there is connectivity and
>   doing so buys accuracy or simplicity (the tutor's example: basic-basket products tolerate more
>   latency in exchange for precision). It must fall back to the local model automatically when
>   there is no coverage, and it must never be the only path.
> - Latency-critical cases (bus lines) stay local by default.
> - Cloud-only recognition, with no local fallback, remains **forbidden** — that is the dependency
>   this ADR exists to prevent.
> - The cloud benchmark added in `app/src/services/vision/` is **development instrumentation only**:
>   it measures time-to-first-token from the phone and must never be called from the
>   camera → detection/OCR → announcement path.
>
> Everything else in this ADR stands. Where the text below says "never a cloud API", read it as
> "never a cloud API *as the only path*".

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
     mobile runtime. "Offload to the phone" means offload to the phone's **local compute**, *not*
     to a server. The concrete runtime and model are decided in
     [ADR 0004](0004-on-device-inference-runtime.md) — **Gemma via LiteRT-LM**, which supersedes the
     TFLite / ONNX Runtime / ExecuTorch options originally listed here.
3. **Internet is optional on every path.** *(Amended 2026-08-10 — this point replaces the original
   "internet only for non-essential features".)* Non-essential features — app/model updates, remote
   config, optional data sync, analytics — may use the network freely and must degrade gracefully.
   On the **essential** recognition path, the cloud is allowed only as an **optional accelerator**
   behind a runtime model gateway, with local inference as the **guaranteed fallback**: losing
   connectivity may degrade accuracy or latency, but must never break recognition or the audio
   response. Cloud-only recognition, with no local fallback, stays forbidden.

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

## Actualización 2026-10-22: el hardware real y la excepción de nube del supermercado

Tres partes del texto de arriba ya no describen el sistema. Se dejan como registro y se leen así:

- **El Coral TPU salió del diseño el 2026-09-07** ([ADR 0006](0006-pipelines-por-caso-de-uso.md),
  actualización 2026-09-07). La placa es una Raspberry Pi Zero 2 W con la Raspberry Pi AI Camera
  (Sony IMX500): el detector de ómnibus (YOLO11n de dos clases, int8) corre dentro del sensor, y la Pi
  hace el recorte del cartel, el OCR (PP-OCRv5 mobile vía ONNX) y el anuncio. Donde el punto 2 dice
  "RPi Zero 2 W + Coral TPU via TensorFlow Lite / OpenCV" y los costos hablan de "Coral-compilation /
  TFLite export", hoy corresponde el export `ultralytics format="imx"` y el `.rpk` armado en la Pi. El
  requisito de este ADR se cumple en el modo ómnibus: corre entero en la placa, sin red, desde el
  2026-09-15 (#88).
- **"Gemma via LiteRT-LM" dejó de ser el camino primario** el 2026-08-22
  ([ADR 0004](0004-on-device-inference-runtime.md), actualización 2026-08-22; ADR 0006).
- **El supermercado va por la nube desde el 2026-08-30**, como excepción explícita y acotada al punto 3
  ("nube sin fallback local, prohibido"): ADR 0006, actualización 2026-08-30. La foto pasa por el proxy
  propio del proyecto ([ADR 0008](0008-proxy-propio-para-claves-de-nube.md)), con `gpt-5.6-luna` por
  defecto y `qwen/qwen3.8-27b` como segunda opción (`MODEL_PROFILES` en
  `app/src/services/vision/config.ts`; ADR 0006, actualización 2026-09-02). Sin red, el modo lo dice y
  no lee. El fallback local del supermercado sigue **PENDIENTE**.

See also: `.claude/skills/virovision/SKILL.md` and `references/app.md`, `references/ml.md`.
