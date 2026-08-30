/**
 * El paso común a los parsers de respuesta de modelo: texto → objeto JSON plano, tolerando
 * bloques ``` y truncamiento (un `stop_reason: "max_tokens"` corta el JSON). Structured outputs
 * hace improbable el JSON inválido, pero no imposible; devolver null en vez de tirar es lo que
 * permite que la voz caiga al texto crudo en lugar de a un error.
 *
 * Módulo puro: sin red, sin estado. Ver schema.test.ts.
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
