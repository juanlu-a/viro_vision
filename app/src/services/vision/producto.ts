/**
 * Lectura de producto de supermercado: tipo, schema, prompts y armado del request (ADR 0006).
 * Módulo puro: sin red, sin estado. Ver producto.test.ts; la llamada de red vive en
 * reconocerProducto.ts.
 *
 * Desde el 2026-08-30 la nube ES el camino de supermercado (el usuario está quieto y tolera
 * latencia a cambio de precisión); el modelo lo elige el usuario en Inicio. Prompt y schema son
 * únicos para todos los proveedores: así cambiar de modelo compara modelos, no preguntas.
 */
import { MODEL_PROFILES } from './config';
import { getProvider } from './providers';
import { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './providers/prompts';
import { parseJsonRecord } from './schema';
import type { ModelProfile, ProviderRequest, TaskPrompts } from './types';

/**
 * Sólo lo que el anuncio de voz necesita. `producto` es qué es y su marca; `detalle` la
 * variedad/sabor/presentación (el objetivo opcional de OCR de etiqueta cabe acá).
 */
export interface ProductoLeido {
  producto: string | null;
  detalle: string | null;
}

/**
 * Schema para structured outputs. Restricciones que exigen las dos APIs: `required` completo,
 * `additionalProperties: false`, sin `minLength` ni restricciones numéricas.
 * Ambos campos admiten null: un envase ilegible tiene que poder decirlo, no inventar.
 */
export const productoSchema = {
  type: 'object',
  properties: {
    producto: { type: ['string', 'null'] },
    detalle: { type: ['string', 'null'] },
  },
  required: ['producto', 'detalle'],
  additionalProperties: false,
} as const;

export const PRODUCTO_PROMPTS: TaskPrompts = {
  system: PRODUCTO_SYSTEM_PROMPT,
  user: PRODUCTO_USER_PROMPT,
};

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
 * Flash y no Flash Lite: en supermercado la complejidad manda sobre la latencia (ADR 0006). Es el
 * default cuando el usuario no eligió nada; con la clave de Gemini presente siempre está disponible.
 */
export const DEFAULT_PRODUCTO_MODEL_ID = 'gemini-3.6-flash';

/** El default resuelto contra el registro, para no repetir el `find` en cada consumidor. */
export const PRODUCTO_MODEL: ModelProfile =
  MODEL_PROFILES.find((profile) => profile.id === DEFAULT_PRODUCTO_MODEL_ID) ?? MODEL_PROFILES[0];

/**
 * Arma el request de lectura de producto para el modelo dado, delegando en su proveedor.
 * `thinking: 'off'` aunque el modelo soporte adaptativo: la respuesta son dos campos y en el tier
 * gratuito el razonamiento multiplica tokens y latencia. Si la precisión no alcanza, es una perilla.
 */
export function buildProductoRequest(input: {
  model: ModelProfile;
  apiKey: string;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
}): ProviderRequest {
  return getProvider(input.model.provider).buildRequest({
    model: input.model,
    apiKey: input.apiKey,
    maxTokens: input.model.maxTokens,
    thinking: 'off',
    effort: 'low',
    imageBase64: input.imageBase64,
    mediaType: input.mediaType,
    prompts: PRODUCTO_PROMPTS,
    schema: productoSchema,
  });
}
