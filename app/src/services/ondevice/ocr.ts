/**
 * Local OCR: detects text regions in a photo and reads them.
 *
 * The product path of bus mode since ADR 0006 (2026-08-22): the device's TPU detects the bus and
 * crops the banner; the app reads the crop with this. What the spike validated as "the only local
 * thing that works without downloading gigabytes" is today the primary path.
 *
 * **Why OCR and not a general-purpose vision model.** Reading "183 · Punta Carretas" off a sign is
 * literally the task an OCR exists for. A VLM does that *in addition to* describing the scene and
 * reasoning about it — capabilities this product does not use and that are paid for in memory,
 * battery and latency. The spike's numbers make it concrete: the smallest multimodal VLM we found
 * asks for 3 GB and fails to load on the phone; this pipeline is ~250 MB and runs.
 *
 * **This is not "going back to YOLO + OCR".** That was roadmap task B1: gather and label a Uruguayan
 * dataset, train YOLO11, pick an OCR. Here the models come trained and ready: they download and
 * work. It is keeping that path's result without paying for the training.
 *
 * The detector returns a **bounding box** as well as the text, and that is not a detail: the thesis
 * asks for prioritizing the most relevant bus when there are several, and position is what makes
 * that possible. A VLM would return a sentence, not coordinates.
 */
import { OCR_SPANISH, OCRModule } from 'react-native-executorch';
import type { OCRDetection } from 'react-native-executorch';

export interface OcrReading {
  /** Everything detected, sorted from highest to lowest confidence. */
  detections: OCRDetection[];
  /** Milliseconds of the pass, measured here so it is comparable with the rest of the spike. */
  ms: number;
}

let ocrModule: OCRModule | null = null;

export function isOcrLoaded(): boolean {
  return ocrModule !== null;
}

/**
 * Downloads (the first time) and loads the Spanish OCR pipeline.
 *
 * Spanish and not English because the alphabet changes the recognizer: destinations carry accents
 * and eñes —"Punta Carretas", "Peñarol", "Estación"— and a recognizer trained without those symbols
 * reads them wrong or drops them.
 */
export async function loadOcr(
  onProgress: (fraction: number) => void,
): Promise<{ ms: number }> {
  releaseOcr();
  const t0 = performance.now();
  ocrModule = await OCRModule.fromModelName(OCR_SPANISH, onProgress);
  return { ms: performance.now() - t0 };
}

/** Reads the text of an image. The path can be `file://…` or absolute. */
export async function readImage(imagePath: string): Promise<OcrReading> {
  if (!ocrModule) throw new Error('The OCR is not loaded.');

  const t0 = performance.now();
  const detections = await ocrModule.forward(imagePath);
  const ms = performance.now() - t0;

  return {
    // Highest confidence first: it is the order a human would look at the results in, and the one
    // that suits picking what to announce when there are several texts in the scene.
    detections: [...detections].sort((a, b) => b.score - a.score),
    ms,
  };
}

export function releaseOcr(): void {
  ocrModule?.delete();
  ocrModule = null;
}
