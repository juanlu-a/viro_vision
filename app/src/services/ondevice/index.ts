/**
 * The local path of bus mode (ADR 0006): OCR over the bus's banner.
 *
 * In the product, the device detects the bus and the app reads the banner here (number and
 * destination). Today the app downloads the whole photo from the device over WiFi and OCRs all of
 * it — which is why the heuristic in `features/reader/reading.ts` still filters candidates. None of
 * this touches the network: it is the path ADR 0001 requires to work without
 * internet.
 */
export { isOcrLoaded, loadOcr, readImage, releaseOcr } from './ocr';
export type { OcrReading } from './ocr';
