/**
 * Lectura de producto de supermercado: tipo, schema y armado del request del candidato nube
 * (ADR 0006). Módulo puro: sin red, sin estado. Ver producto.test.ts; la llamada de red vive en
 * reconocerProducto.ts.
 *
 * A diferencia del benchmark, esto NO es instrumentación: desde ADR 0006 la nube es candidata
 * real del camino de supermercado — el usuario está quieto y tolera latencia a cambio de
 * precisión. La decisión (Gemma 3 1B local vs. Gemini Flash) sigue abierta; mientras tanto los
 * dos candidatos comparten prompt y forma de respuesta para que la comparación mida el modelo.
 */
import { MODEL_PROFILES, GEMINI_INTERACTIONS_URL } from './config';
import { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './providers/prompts';
import { parseJsonRecord } from './schema';
import type { ModelProfile, ProviderRequest } from './types';

/**
 * Como `BusReading`: sólo lo que el anuncio de voz necesita. `producto` es qué es y su marca;
 * `detalle` la variedad/sabor/presentación (el objetivo opcional de OCR de etiqueta cabe acá).
 */
export interface ProductoLeido {
  producto: string | null;
  detalle: string | null;
}

/** Mismas restricciones que busReadingSchema: required completo, sin additionalProperties. */
export const productoSchema = {
  type: 'object',
  properties: {
    producto: { type: ['string', 'null'] },
    detalle: { type: ['string', 'null'] },
  },
  required: ['producto', 'detalle'],
  additionalProperties: false,
} as const;

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Parsea y valida la respuesta del modelo; null ante JSON inválido o forma inesperada. */
export function parseProductoLeido(text: string): ProductoLeido | null {
  const candidate = parseJsonRecord(text);
  if (!candidate) return null;

  if (!isStringOrNull(candidate.producto)) return null;
  if (!isStringOrNull(candidate.detalle)) return null;

  return { producto: candidate.producto, detalle: candidate.detalle };
}

/**
 * Flash y no Flash Lite: en supermercado la complejidad manda sobre la latencia (ADR 0006), y
 * al ser otro model id la cuota del tier gratuito es independiente de la del benchmark.
 */
export const PRODUCTO_MODEL: ModelProfile = MODEL_PROFILES.find(
  (profile) => profile.provider === 'gemini' && profile.id.includes('flash') && !profile.id.includes('lite'),
) ?? MODEL_PROFILES[0];

/** Arma el request a Gemini para leer un producto. Mismo transporte que el resto (SSE). */
export function buildProductoRequest(input: {
  apiKey: string;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
}): ProviderRequest {
  return {
    url: GEMINI_INTERACTIONS_URL,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': input.apiKey,
    },
    body: {
      model: PRODUCTO_MODEL.id,
      stream: true,
      input: [
        { type: 'text', text: PRODUCTO_SYSTEM_PROMPT },
        { type: 'image', data: input.imageBase64, mime_type: input.mediaType },
        { type: 'text', text: PRODUCTO_USER_PROMPT },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: productoSchema,
      },
    },
  };
}
