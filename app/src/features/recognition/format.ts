/**
 * Turns a recognition event into the Spanish phrase the app speaks. Centralizing this keeps the
 * auditory feedback consistent and easy to tune (the thesis calls for clear, non-overwhelming
 * announcements that prioritize the most relevant item).
 */
import type { Detection, RecognitionEvent } from './types';

function describe(d: Detection): string {
  return d.kind === 'bus_line' ? `Línea ${d.label}` : d.label;
}

/**
 * Builds the announcement string. Announces the primary detection first; optionally appends a brief
 * mention of other detected items so the user is aware of them without auditory overload.
 */
export function toAnnouncement(event: RecognitionEvent, mentionOthers = false): string {
  const primary = describe(event.primary);
  if (!mentionOthers || event.others.length === 0) return primary;

  const others = event.others.map(describe).join(', ');
  return `${primary}. También: ${others}`;
}
