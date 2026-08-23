/**
 * El candidato NUBE del camino de supermercado (ADR 0006): manda la foto a Gemini Flash y
 * devuelve el producto leído. Comparte errores tipados y limitador de cuota con el resto de la
 * capa de visión, pero NO pasa por benchmark.ts — aquello es instrumentación de desarrollo y
 * esto es camino de producto.
 *
 * REGLA DE FRONTERA (ADR 0001 + ADR 0006): prohibido llamar esto desde el camino de ómnibus.
 * En bondis la latencia manda y el reconocimiento es local (detección + OCR); una nube sin señal
 * en la calle pierde el ómnibus. Además, quien llame esto debe tener fallback local: si no hay
 * internet, el reconocimiento degrada a un estado rotulado — nunca desaparece.
 */
import { fetch } from 'expo/fetch';

import { geminiApiKey, isGeminiConfigured } from './config';
import { VisionHttpError, VisionNotConfiguredError, VisionQuotaError, VisionStreamError } from './errors';
import { buildProductoRequest, parseProductoLeido, PRODUCTO_MODEL } from './producto';
import type { ProductoLeido } from './producto';
import { geminiProvider } from './providers';
import { acquireSlot } from './rateLimiter';
import { readSseStream } from './sse';

export interface ReconocimientoProducto {
  /** La respuesta validada contra el schema, o null si el modelo no devolvió el JSON pedido. */
  producto: ProductoLeido | null;
  /** Texto completo de la respuesta, como respaldo visible cuando el parseo falla. */
  texto: string;
  /** Milisegundos de punta a punta. Informativo: la métrica formal la toma el benchmark. */
  ms: number;
}

export async function reconocerProducto(options: {
  /** Imagen en base64, SIN el prefijo `data:image/...;base64,`. */
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  signal?: AbortSignal;
}): Promise<ReconocimientoProducto> {
  if (!isGeminiConfigured) throw new VisionNotConfiguredError();

  const request = buildProductoRequest({
    apiKey: geminiApiKey,
    imageBase64: options.imageBase64,
    mediaType: options.mediaType,
  });
  const payloadJson = JSON.stringify(request.body);

  // La cuota se respeta ANTES de enviar, igual que en el benchmark: el tier gratuito es la
  // restricción dura de gratuidad de ADR 0006, y agotarlo rompe el modo entero, no una medición.
  await acquireSlot(PRODUCTO_MODEL.id, { signal: options.signal });
  if (options.signal?.aborted) throw new VisionStreamError('cancelado');

  const t0 = performance.now();
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: payloadJson,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new VisionHttpError(response.status, await response.text());
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

    const event = geminiProvider.readEvent(payload);
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

  return { producto: parseProductoLeido(texto), texto, ms: performance.now() - t0 };
}
