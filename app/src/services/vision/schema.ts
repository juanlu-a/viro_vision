/**
 * JSON Schema pedido al modelo (structured outputs) y su parser.
 *
 * Sólo dos campos: número de línea y nombre. Cuanto más chica la respuesta, menos tokens de
 * salida y menor latencia total — y son los dos datos que el anuncio de voz necesita.
 *
 * Módulo puro: sin red, sin estado. Ver schema.test.ts.
 */
import type { BusReading } from './types';

/**
 * Schema para `output_config.format`. Restricciones de la API a respetar:
 * `additionalProperties: false` y `required` completos son obligatorios; no se admiten
 * `minLength` ni restricciones numéricas (se validan del lado del cliente si hace falta).
 *
 * Ambos campos admiten null: un cartel ilegible tiene que poder decirlo, no inventar.
 */
export const busReadingSchema = {
  type: 'object',
  properties: {
    numero: { type: ['string', 'null'] },
    nombre: { type: ['string', 'null'] },
  },
  required: ['numero', 'nombre'],
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

  if (!isStringOrNull(candidate.numero)) return null;
  if (!isStringOrNull(candidate.nombre)) return null;

  return { numero: candidate.numero, nombre: candidate.nombre };
}

function stripCodeFence(text: string): string {
  if (!text.startsWith('```')) return text;
  const withoutOpening = text.replace(/^```[a-zA-Z]*\n?/, '');
  return withoutOpening.replace(/\n?```$/, '');
}
