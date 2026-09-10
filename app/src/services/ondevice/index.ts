/**
 * The local path of bus mode (ADR 0006): OCR over the bus's banner.
 *
 * In the product, the device's TPU detects the bus and sends the app only the banner crop (number
 * and destination); here it gets read. Today, with no hardware, the app receives the whole photo
 * from the photo library — which is why the heuristic in `features/reader/reading.ts` still filters
 * candidates. None of this touches the network: it is the path ADR 0001 requires to work without
 * internet.
 */
export { isOcrLoaded, loadOcr, readImage, releaseOcr } from './ocr';
export type { OcrReading } from './ocr';
