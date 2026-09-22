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
  /**
   * The second half of a bus reading: the destination on the sign (`115` -> `LUIS BRAILLE`). The
   * device sends it as `detail` and it is the first thing trimmed when the event does not fit in one
   * BLE notification, so it can be absent on a reading whose number came through.
   *
   * It exists because without it the destination was **read on the board and then dropped here**:
   * the board announced the whole line through its own speaker while a user listening on the phone
   * heard only "Línea 115", with nothing anywhere saying why (reported 2026-09-22).
   *
   * Uppercase, as the STM catalogue spells it. Some of its entries are abbreviations (`PZA.ESPANA`,
   * `V.FARRE`) that a speech synthesizer reads poorly; that is the catalogue's problem, not this
   * field's, and rewriting them here would make the app disagree with the board's recordings.
   */
  detail?: string;
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
