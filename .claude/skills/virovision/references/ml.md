# Pillar: ML / OCR / Computer Vision

## Tasks
1. **Object detection** — locate buses and products in the frame (bounding boxes, multiple
   instances/classes per image).
2. **OCR** — read the bus line's number/name from its display, and (optional) read product-label
   text.
3. **Prioritization logic** — when several buses are detected, decide which line to announce first
   (position/proximity) and optionally mention others without auditory overload.

## Models & techniques

### YOLO (You Only Look Once) — object detection
Single-pass detection (class + bounding box), well suited to **real-time / low-latency** and
embedded use. Target version **YOLO11**, usable for detection/segmentation/classification/pose.
Pretrained on **COCO** (80 common classes — includes `person`, `car`, `bus`, `bicycle`, …), giving
a useful starting point. Comes in **size variants** (nano → large): pick small models for the
constrained device, larger ones when more compute is available — key for the edge/mobile tradeoff
(latency, memory, device compatibility).

### OCR
Deep-learning OCR (robust to variable lighting, non-ideal angles, diverse fonts). Central to
ViroVision for reading **bus line numbers/names** and **product-label text**. Extra challenges to
research: LED-display / vehicle-sign OCR, motion and lighting variability.

### Edge AI / on-device (offline-first, hard requirement)
Local inference is the **guaranteed fallback**, so essential recognition works **offline**. Two
deployment targets, both fully local:
- **On the device:** RPi Zero 2 W + Coral TPU via **TensorFlow Lite / OpenCV**.
- **On the phone** ("offload to phone" architecture): the model runs on the phone's own compute, not
  on a server. Runtime decided in **ADR 0004**: **Gemma via LiteRT-LM** (supersedes the TFLite /
  ONNX Runtime / ExecuTorch options originally listed here; MediaPipe LLM Inference is in
  maintenance mode).

**Since ADR 0001 was amended (2026-08-10), the cloud is allowed as an *optional accelerator*** —
never as the only path, and never for latency-critical cases. See
[references/decisiones.md](decisiones.md).

Benefits: low latency (no connectivity dependency), data privacy (local processing), offline
operation. Choose model size/quantization (e.g. INT8, Coral-compiled / TFLite) to fit both the
device and the phone-bundle size budget.

**Pregunta de alcance abierta, para el tutor** (ADR 0004): si un Gemma multimodal lee el cartel
directamente, el pipeline **YOLO + OCR deja de ser necesario en el camino del teléfono**. Eso no es
una optimización — borraría buena parte de la tarea B1, que el documento de tesis describe como *el*
método. Recomendación registrada: conservar los dos y **medirlos uno contra otro**.

## Datasets
Custom datasets to be **generated and labeled** for (a) metropolitan bus lines and (b) basic-basket
supermarket products — capture, preprocess, label, train/fine-tune, evaluate on held-out test data.

## Open / pending (`PENDIENTE` in the thesis)
- **Google Gemma** for edge — architecture, edge variants, vision performance, viability on the
  chosen hardware, and comparison vs. MobileNet / EfficientDet / YOLO-nano.
- **State of the art**: OCR on transport signage / LED displays; supermarket product recognition
  (barcode vs. direct vision; existing datasets); real-time detection benchmarks on embedded HW.

## Status
Approach chosen (YOLO11 + OCR + TFLite on edge). Datasets, training/fine-tuning and edge export are
still to be done.
