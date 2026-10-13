/**
 * The pure part of the reader: what counts as a reading and how it becomes a spoken phrase.
 *
 * It lives outside the hook because voice IS this app's interface: a regression here shows up on
 * no screen, it is heard — and without tests nobody hears it before the user does. See
 * reading.test.ts.
 */
import { strings } from '@/i18n';
import type { ProductReading } from '@/services/vision';

const t = strings.reader;

/**
 * What the bus announcement needs: line number and destination. It lives here and not in the cloud
 * layer because the bus path is local (ADR 0006) and must not import anything from
 * `services/vision`.
 */
export interface BusReading {
  /** Line number on the front sign (e.g. "116"), or null when it could not be read. */
  line: string | null;
  /** Destination / name of the line (e.g. "Plaza Independencia"), or null. */
  destination: string | null;
}


/** Two to four digits with reasonable confidence makes it a line-number candidate. */
export function guessBusReading(texts: { text: string; score: number }[]): BusReading {
  const line = texts.find((d) => /^\d{2,4}$/.test(d.text.trim()) && d.score > 0.3);
  const destination = texts.find(
    (d) => d !== line && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(d.text) && d.score > 0.3,
  );
  return { line: line?.text.trim() ?? null, destination: destination?.text.trim() ?? null };
}

/** The phrase announced in bus mode. Raw text is the fallback, never silence. */
export function phraseBusReading(reading: BusReading | null, raw: string | null): string {
  if (reading?.line && reading?.destination) return `${t.line} ${reading.line}, ${reading.destination}`;
  if (reading?.line) return `${t.line} ${reading.line}`;
  if (reading?.destination) return reading.destination;
  if (raw) return raw;
  return t.nothingRead;
}

/**
 * The phrase announced in supermarket mode: kind, brand and only then the detail.
 *
 * The order is not cosmetic. Someone who cannot see hears the whole phrase before being able to
 * decide, so whatever discriminates most goes first: "arroz Saman, Blue Patna 1 kg" and not
 * "Blue Patna 1 kg, arroz". Each field can be missing on its own (the model returns null for what
 * it cannot read), and saying two out of three is still useful — that is why the phrase is built
 * from whatever is there instead of requiring all of them. Raw text is the fallback, never silence.
 */
export function phraseProduct(product: ProductReading | null, raw: string | null): string {
  const head = [product?.kind, product?.brand].filter(Boolean).join(' ');
  const parts = [head, product?.detail].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (raw && isSpokenAnswer(raw)) return raw;
  return t.nothingReadProduct;
}

/**
 * Whether the model's raw answer is prose worth saying out loud.
 *
 * The raw fallback above exists for a good reason —a model that replies in free text instead of JSON
 * says something useful, and saying it beats admitting defeat— but it used to say **anything**. Heard
 * on the device on 2026-09-11: pointed at something that was not food, the model answered the bare
 * literal `null`, the parser rejected it (a JSON `null` is not a record), and the phrase fell through
 * to the raw text. **The board said «null» out loud.**
 *
 * The rule that separates the two cases: **prose does not parse as JSON.** "arroz Saman" throws;
 * `null`, `{}`, `[]`, `""` and a leftover JSON object all parse, and none of them is a reading. That
 * also covers the answer that is valid JSON in an unexpected shape (`{"producto": "arroz"}`), which
 * before this was read out field names and all.
 */
function isSpokenAnswer(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  try {
    JSON.parse(trimmed);
    return false;
  } catch {
    return true;
  }
}
