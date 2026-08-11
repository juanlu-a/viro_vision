/**
 * JSON Schema pedido al modelo (structured outputs) y su parser.
 *
 * Módulo puro: sin red, sin estado. Ver schema.test.ts.
 */
import type { BusReading } from './types';

/**
 * Schema para `output_config.format`. Restricciones de la API a respetar:
 * `additionalProperties: false` y `required` completos son obligatorios; no se admiten
 * `minimum`/`maximum`/`minLength` (se validan del lado del cliente si hace falta).
 */
export const busReadingSchema = {
  type: 'object',
  properties: {
    line: { type: ['string', 'null'] },
    destination: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    raw_text: { type: 'array', items: { type: 'string' } },
  },
  required: ['line', 'destination', 'confidence', 'raw_text'],
  additionalProperties: false,
} as const;

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Parsea y valida la respuesta del modelo. Devuelve null ante JSON inválido o forma inesperada
 * — structured outputs lo hace improbable, pero un `stop_reason: "max_tokens"` trunca el JSON.
 *
 * Tolera envoltura en bloques ``` por si el modelo la agrega pese al schema.
 */
export function parseBusReading(text: string): BusReading | null {
  const trimmed = stripCodeFence(text.trim());
  if (trimmed.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;

  if (!isStringOrNull(candidate.line)) return null;
  if (!isStringOrNull(candidate.destination)) return null;
  if (typeof candidate.confidence !== 'number' || Number.isNaN(candidate.confidence)) return null;
  if (!Array.isArray(candidate.raw_text)) return null;
  if (!candidate.raw_text.every((item) => typeof item === 'string')) return null;

  return {
    line: candidate.line,
    destination: candidate.destination,
    confidence: candidate.confidence,
    raw_text: candidate.raw_text as string[],
  };
}

function stripCodeFence(text: string): string {
  if (!text.startsWith('```')) return text;
  const withoutOpening = text.replace(/^```[a-zA-Z]*\n?/, '');
  return withoutOpening.replace(/\n?```$/, '');
}
