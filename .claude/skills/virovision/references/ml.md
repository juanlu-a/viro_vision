# Pillar: ML / OCR / Computer Vision

## Tasks
1. **Object detection** — locate buses and products in the frame (bounding boxes, multiple
   instances/classes per image).
2. **OCR** — read the bus line's number/name from its display, and (optional) read product-label
   text.
3. **Prioritization logic** — when several buses are detected, decide which line to announce first
   (position/proximity) and optionally mention others without auditory overload.

## Models & techniques

### Detection — pretrained, running on the Coral TPU as a preprocessor
Single-pass detection (class + bounding box), well suited to **real-time / low-latency** and
embedded use. Candidates: **YOLO11-nano / `yolo26` / `rfdetr-nano`** — all pretrained on **COCO**
(80 classes, includes `bus`), so **no training is required**. Since ADR 0006 (2026-08-22) the
detector's role is **preprocessing on the device's Coral TPU**: detect the bus → crop the banner
strip → hand only the crop to the OCR (best case: the whole pipeline runs on the TPU). The crop is
what removes OCR distractions (license plates, ads) and gives it large letters; the box size gives
proximity-based prioritization for free.

### OCR
Deep-learning OCR (robust to variable lighting, non-ideal angles, diverse fonts). Central to
ViroVision for reading **bus line numbers/names** and **product-label text**. Extra challenges to
research: LED-display / vehicle-sign OCR, motion and lighting variability.

### Edge AI / on-device (offline-first, hard requirement)
Local inference is the **guaranteed fallback**, so essential recognition works **offline**. Since
**ADR 0006** (2026-08-22) there is no single runtime — **each use case has its own pipeline**:

- **Buses (latency rules) → fully local:** detection on the **Coral TPU** (pretrained, see above)
  → banner crop → **OCR (CRAFT + CRNN, Spanish, ~250 MB)** on the crop, via **ExecuTorch** on the
  phone (or on the TPU if it fits). No LLM in this path.
- **Supermarket (complexity rules) → vision LLM in the cloud (decided 2026-08-30):** Gemini Flash
  by default, model selectable in the app (Anthropic if the build carries a key). Hard constraint:
  the model must be **free for the user**. Without internet or key the mode *says so* — the **local
  fallback is still pending**: measuring **Gemma 3 1B (~700 MB, NOT the 3 GB multimodal)** *with
  vision* on real products. Until then this is a documented, scoped exception to ADR 0001.

**LiteRT-LM is no longer the primary path** (superseding what ADR 0004 originally proposed): the
2026-08 spike showed its vision path is broken on iOS (library bug, isolated with evidence), while
the same model works via **ExecuTorch** — but the 3 GB multimodal VLM takes ~6.4 s total, too slow
for buses. It remains a comparison term in the report. The lab code was retired from the app on
2026-08-30 (one runtime left: ExecuTorch for OCR) and preserved in branch
`spike/laboratorio-vision-local`. See
[`docs/spike-vision-local.md`](../../../../docs/spike-vision-local.md) and
[`docs/pruebas-y-decisiones.md`](../../../../docs/pruebas-y-decisiones.md).

**Since ADR 0001 was amended (2026-08-10), the cloud is allowed as an *optional accelerator*** —
never as the only path, and never for latency-critical cases. See
[references/decisiones.md](decisiones.md).

**La pregunta de alcance de ADR 0004 quedó cerrada por ADR 0006**: el VLM multimodal no reemplaza
a detección + OCR en el camino del teléfono (6,4 s contra fracciones de segundo, y sin coordenadas
para priorizar). Detección + OCR es el camino primario de bondis; el VLM queda como término de
comparación en el informe.

## Datasets — evaluation, not training (ADR 0006)
Custom **evaluation datasets** to be generated and labeled for (a) metropolitan bus lines and (b)
basic-basket supermarket products: expected result vs. obtained result. The models are pretrained;
**nothing gets trained**. The metrics — **recall, precision, accuracy, F1** — are *the* way this
project measures precision, and the instrument that closes the pending supermarket decision
(Gemma 3 1B vs. Gemini Flash). Definitions and what each metric captures per use case:
[`docs/pruebas-y-decisiones.md`](../../../../docs/pruebas-y-decisiones.md).

## Open / pending (`PENDIENTE` in the thesis)
- **Google Gemma** for edge — architecture, edge variants, vision performance, viability on the
  chosen hardware, and comparison vs. MobileNet / EfficientDet / YOLO-nano.
- **State of the art**: OCR on transport signage / LED displays; supermarket product recognition
  (barcode vs. direct vision; existing datasets); real-time detection benchmarks on embedded HW.

## Status
Pipelines decided per use case (ADR 0006, Proposed — tutor validation pending): buses = detection
on Coral TPU → banner crop → OCR; supermarket = vision LLM (local small vs. cloud, **pending**).
Still to be done: evaluation datasets + metrics, detector export/measurement on the Coral TPU, and
the supermarket decision.
