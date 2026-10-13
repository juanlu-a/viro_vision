/**
 * The step every model-response parser shares: text → flat JSON object, tolerating ``` blocks and
 * truncation (a `stop_reason: "max_tokens"` cuts the JSON short). Structured outputs make invalid
 * JSON unlikely, but not impossible; returning null instead of throwing is what lets the voice fall
 * back to the raw text rather than to an error.
 *
 * Pure module: no network, no state. See schema.test.ts.
 */

export function parseJsonRecord(text: string): Record<string, unknown> | null {
  const trimmed = stripCodeFence(text.trim());
  if (trimmed.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stripCodeFence(text: string): string {
  if (!text.startsWith('```')) return text;
  const withoutOpening = text.replace(/^```[a-zA-Z]*\n?/, '');
  return withoutOpening.replace(/\n?```$/, '');
}
