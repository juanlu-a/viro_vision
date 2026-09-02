/**
 * El camino de supermercado (ADR 0006): manda la foto al modelo de visión en la nube que eligió el
 * usuario y devuelve el producto leído.
 *
 * REGLA DE FRONTERA (ADR 0001 + ADR 0006): prohibido llamar esto desde el camino de ómnibus. En
 * bondis la latencia manda y el reconocimiento es local (OCR sobre el banner recortado por la TPU);
 * una nube sin señal en la calle pierde el ómnibus. El linter lo fuerza en `eslint.config.js`.
 *
 * Sin internet o sin clave, este camino falla con un error tipado y la UI **avisa**: no hay
 * fallback local para supermercado todavía. Es una excepción acotada y documentada a la
 * restricción 2 de ADR 0001 (ver ADR 0006, actualización 2026-08-30); cerrarla exige evaluar un
 * modelo chico local (Gemma 3 1B) sobre productos reales.
 */
import { fetch } from 'expo/fetch';

import { resolverTransporte } from '@/services/cloud';

import { apiKeyFor, isProviderConfigured } from './config';
import {
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  VisionStreamError,
} from './errors';
import { interpretarErrorHttp } from './httpError';
import { buildProductoRequest, parseProductoLeido, PRODUCTO_MODEL } from './producto';
import type { ProductoLeido } from './producto';
import { getProvider } from './providers';
import { acquireSlot, limitePorMinuto } from './rateLimiter';
import { readSseStream } from './sse';
import type { ModelProfile } from './types';

export interface ReconocimientoProducto {
  /** La respuesta validada contra el schema, o null si el modelo no devolvió el JSON pedido. */
  producto: ProductoLeido | null;
  /** Texto completo de la respuesta, como respaldo visible cuando el parseo falla. */
  texto: string;
  /** Milisegundos de punta a punta, informativos. */
  ms: number;
  /** Qué modelo respondió: se muestra junto al resultado. */
  model: string;
}

export async function reconocerProducto(options: {
  /** Imagen en base64, SIN el prefijo `data:image/...;base64,`. */
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  /** Por defecto, el modelo default de producto. Lo fija el selector de Inicio. */
  model?: ModelProfile;
  /** Se llama si hay que esperar cupo, con los milisegundos estimados, para poder anunciarlo. */
  onWait?: (waitMs: number) => void;
  signal?: AbortSignal;
}): Promise<ReconocimientoProducto> {
  const model = options.model ?? PRODUCTO_MODEL;
  if (!isProviderConfigured(model.provider)) throw new VisionNotConfiguredError();

  const provider = getProvider(model.provider);
  // El proveedor arma su request igual que siempre; el transporte decide si sale directo o por el
  // proxy (ADR 0008). Con proxy, `apiKeyFor` devuelve '' y las cabeceras que la llevarían se
  // descartan: la clave la pone el servidor.
  const request = resolverTransporte(
    buildProductoRequest({
      model,
      apiKey: apiKeyFor(model.provider),
      imageBase64: options.imageBase64,
      mediaType: options.mediaType,
    }),
    model.provider,
  );
  const payloadJson = JSON.stringify(request.body);

  // La cuota se respeta ANTES de enviar: agotarla frena el modo entero. El tope es el del
  // proveedor del modelo elegido, no uno global — ver `limitePorMinuto`.
  //
  // `onWait` existe para que la espera se pueda anunciar: quedarse callado mientras la app duerme
  // hasta un minuto es indistinguible de estar colgada para alguien que no ve la pantalla.
  await acquireSlot(model.id, {
    signal: options.signal,
    maxPerWindow: limitePorMinuto(model.provider),
    onWait: options.onWait,
  });
  if (options.signal?.aborted) throw new VisionStreamError('cancelado');

  const t0 = performance.now();
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: payloadJson,
      signal: options.signal,
    });
  } catch (err) {
    if (options.signal?.aborted) throw new VisionStreamError('cancelado');
    throw new VisionNetworkError(err instanceof Error ? err.message : String(err));
  }

  if (!response.ok) {
    // La cuota no siempre llega como evento SSE: Groq la devuelve como 429 ANTES de abrir el
    // stream. Sin este intérprete ese camino lanzaba VisionHttpError y la UI decía "la nube no
    // respondió" en vez de "cuota agotada, reintentá en N s" (medido el 2026-09-02).
    throw interpretarErrorHttp(
      response.status,
      await response.text(),
      response.headers.get('retry-after'),
    );
  }
  if (!response.body) {
    throw new VisionStreamError('La respuesta no trae body legible (¿streaming no soportado?).');
  }

  let texto = '';
  let streamError: string | null = null;
  let quotaRetryAfter: number | null = null;

  await readSseStream(response.body, (frame) => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(frame.data) as Record<string, unknown>;
    } catch {
      return; // keep-alives y el `data: [DONE]` con que cierra Gemini
    }

    const event = provider.readEvent(payload);
    if (!event) return;
    if (event.kind === 'text') texto += event.text;
    if (event.kind === 'error') {
      streamError = event.message;
      if (event.code === 'quota_exceeded') quotaRetryAfter = event.retryAfterSeconds ?? 30;
    }
  });

  if (streamError) {
    if (quotaRetryAfter != null) throw new VisionQuotaError(streamError, quotaRetryAfter);
    throw new VisionStreamError(streamError);
  }

  return { producto: parseProductoLeido(texto), texto, ms: performance.now() - t0, model: model.id };
}
