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
 * Sólo lo que el anuncio de voz necesita, en tres campos SEPARADOS: `tipo` es qué es (arroz,
 * harina, fideos…), `marca` de quién es, y `detalle` la variedad/sabor/presentación (el objetivo
 * opcional de OCR de etiqueta cabe acá).
 *
 * Tipo y marca están separados y no en un solo nombre porque son dos datos con prioridades
 * distintas para quien no ve: el tipo es lo que decide si el producto sirve, la marca sólo cuál de
 * los que sirven. Separados, el anuncio puede decir el tipo aunque la marca no se lea (y al revés),
 * en vez de perder los dos por un campo que el modelo no pudo completar entero.
 */
export interface ProductoLeido {
  tipo: string | null;
  marca: string | null;
  detalle: string | null;
}

/**
 * Schema para structured outputs. Restricciones que exigen las dos APIs: `required` completo,
 * `additionalProperties: false`, sin `minLength` ni restricciones numéricas.
 * Los tres campos admiten null: un envase ilegible tiene que poder decirlo, no inventar.
 */
export const productoSchema = {
  type: 'object',
  properties: {
    tipo: { type: ['string', 'null'] },
    marca: { type: ['string', 'null'] },
    detalle: { type: ['string', 'null'] },
  },
  required: ['tipo', 'marca', 'detalle'],
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

  if (!isStringOrNull(candidate.tipo)) return null;
  if (!isStringOrNull(candidate.marca)) return null;
  if (!isStringOrNull(candidate.detalle)) return null;

  return { tipo: candidate.tipo, marca: candidate.marca, detalle: candidate.detalle };
}

/**
 * El default cuando el usuario no eligió nada.
 *
 * No es el más rápido de los medidos —lo es `qwen/qwen3.8-27b`, casi el doble— sino **el más rápido
 * que aguanta un recorrido de góndola**: la cuota gratuita de Groq son ~4 lecturas por minuto y
 * alguien eligiendo productos hace del orden de 2 a 4. Un default que choca el límite a la cuarta
 * lectura es peor producto que uno 800 ms más lento.
 *
 * Antes era `gemini-3.5-flash-lite`. Cambió el 2026-09-02 con la medición contra las APIs reales:
 * Gemini dio mediana 10 649 ms con un rango de 2820 a 32 586 ms, y lo que descarta no es la mediana
 * sino la dispersión — para quien espera el audio, un modelo que a veces tarda medio minuto es peor
 * que uno que siempre tarda menos de dos segundos. Ver
 * `docs/mediciones/2026-09-02-modelos-supermercado.md`.
 */
export const DEFAULT_PRODUCTO_MODEL_ID = 'gpt-5.6-luna';

/** El default resuelto contra el registro, para no repetir el `find` en cada consumidor. */
export const PRODUCTO_MODEL: ModelProfile =
  MODEL_PROFILES.find((profile) => profile.id === DEFAULT_PRODUCTO_MODEL_ID) ?? MODEL_PROFILES[0];

/**
 * Arma el request de lectura de producto para el modelo dado, delegando en su proveedor.
 * `thinking: 'off'` aunque el modelo soporte adaptativo: la respuesta son tres campos cortos y en
 * el tier gratuito el razonamiento multiplica tokens y latencia. Si la precisión no alcanza, es
 * una perilla.
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
