# ViroVision — ML / OCR / Computer Vision

Recognition models that identify **bus lines** and **supermarket products** and feed results to the
app for auditory feedback.

## Tasks

1. **Object detection** — locate buses and products (bounding boxes, multiple instances/classes).
2. **OCR** — read bus line numbers/names from displays; (optional) read product-label text.
3. **Prioritization** — pick the most relevant detection to announce first (position/proximity).

## Approach

- **YOLO11** for detection (COCO-pretrained base; already knows `person`, `car`, `bus`, …). Size
  variants let us trade accuracy vs. latency for the edge device.
- **OCR** with a deep-learning engine robust to lighting/angle/font variation.
- **Edge inference** via **TensorFlow Lite / OpenCV**, accelerated by the Coral TPU on the device.

## Datasets

Custom datasets to be generated and labeled for (a) metropolitan bus lines and (b) basic-basket
products. Keep raw datasets, model weights and training runs **out of git** (see root `.gitignore`)
— use external storage / DVC.

## Suggested layout (create as work starts)

```
ml/
  datasets/     # raw + labeled data (gitignored)
  training/     # YOLO11 / OCR training scripts and configs
  export/       # TFLite / Coral edge export
  eval/         # benchmarks (accuracy, latency on target hardware)
  runs/         # training outputs (gitignored)
```

## Open (flagged pending in the thesis)

- **Google Gemma** for edge (viability on the chosen hardware; vs. MobileNet / EfficientDet / YOLO-nano).
- **State of the art**: OCR on transport signage / LED displays; supermarket product recognition;
  real-time edge detection benchmarks.

See `.claude/skills/virovision/references/ml.md` for detail.
