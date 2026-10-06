/**
 * An error, as the telemetry table wants it: a short string, whatever was thrown.
 *
 * Since 2026-10-06 the user never sees nor hears an error's text — the table is its only reader —
 * so every call site was writing the same `err instanceof Error ? err.message : String(err)`. One
 * helper means one cap: a body echoed back by a provider can be kilobytes long, and the function
 * replaces a detail over 8 KB with `{trimmed: true}`, losing the whole row's context with it.
 *
 * Pure: no React Native, so it is tested without mocks.
 */
const MAX_LENGTH = 500;

export function errorDetail(err: unknown): string {
  let text: string;
  if (err instanceof Error) text = err.message || err.name;
  else if (typeof err === 'string') text = err;
  else {
    try {
      text = JSON.stringify(err) ?? String(err);
    } catch {
      text = String(err);
    }
  }
  return text.slice(0, MAX_LENGTH);
}

/** The error's type, for grouping rows: the class name when there is one. */
export function errorType(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}
