/**
 * Recognition domain model.
 *
 * These types are the contract between the ML/device pillar (which produces detections) and the
 * app's audio-feedback pillar (which announces them). The physical device or the phone runs the
 * CV/OCR models; the app receives results shaped like this over the BLE data channel and decides
 * what to speak. Kept intentionally minimal and stable — implementations fill it in later.
 */

/** The two core use cases ViroVision recognizes. */
export type RecognitionKind = 'bus_line' | 'product';

/** A single detected item with the confidence and (optional) position of its bounding box. */
export interface Detection {
  kind: RecognitionKind;
  /** Bus line number/name (OCR) or product name. */
  label: string;
  /** Model confidence in [0, 1]. */
  confidence: number;
  /**
   * Relative position used to prioritize which item to announce first (e.g. the closest/leftmost
   * bus). Normalized to [0, 1] within the frame; undefined when position is not available yet.
   */
  position?: { x: number; y: number };
}

/**
 * A recognition event delivered to the app. `primary` is the most relevant detection to announce
 * first (per the prioritization requirement); `others` may be mentioned without auditory overload.
 */
export interface RecognitionEvent {
  timestamp: number;
  primary: Detection;
  others: Detection[];
}
