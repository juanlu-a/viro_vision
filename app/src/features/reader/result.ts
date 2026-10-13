/**
 * The readable rows of a reading's result, for the screen. The VOICE says the phrase built by
 * `phraseProduct` / `phraseBusReading`; this is the visual record for whoever can see, or for
 * whoever walks the screen row by row with the screen reader. Pure, so it can be tested: if
 * "Marca" showed the kind, or a null field printed as "null", the screen would lie without anyone
 * noticing.
 */
import { strings } from '@/i18n';
import type { ProductReading } from '@/services/vision';

import type { BusReading } from './reading';

const t = strings.reader;

export interface ResultRow {
  label: string;
  value: string;
  /** True when the model could not read that field: it is dimmed and the voice says "sin leer". */
  empty: boolean;
}

function row(label: string, value: string | null | undefined): ResultRow {
  const clean = value?.trim() ?? '';
  return clean ? { label, value: clean, empty: false } : { label, value: t.fieldUnread, empty: true };
}

export function productRows(product: ProductReading): ResultRow[] {
  return [row(t.productField, product.kind), row(t.brandField, product.brand), row(t.detailField, product.detail)];
}

export function busLineRows(reading: BusReading): ResultRow[] {
  return [row(t.line, reading.line), row(t.destinationField, reading.destination)];
}
