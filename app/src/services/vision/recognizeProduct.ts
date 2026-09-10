/**
 * The supermarket path (ADR 0006): sends the photo to the cloud vision model the user picked and
 * returns the product it read.
 *
 * BOUNDARY RULE (ADR 0001 + ADR 0006): calling this from the bus path is forbidden. On buses
 * latency rules and recognition is local (OCR over the banner cropped by the TPU); a cloud with no
 * signal on the street misses the bus. The linter enforces it in `eslint.config.js`.
 *
 * With no internet or no key this path fails with a typed error and the UI **says so**: there is no
 * local fallback for supermarket yet. It is a bounded, documented exception to constraint 2 of
 * ADR 0001 (see ADR 0006, 2026-08-30 update); closing it requires evaluating a small local model
 * (Gemma 3 1B) against real products.
 */
import { fetch } from 'expo/fetch';

import { resolveTransport } from '@/services/cloud';

import { apiKeyFor, isProviderConfigured } from './config';
import {
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  VisionStreamError,
} from './errors';
import { interpretHttpError } from './httpError';
import { buildProductRequest, parseProductReading, PRODUCT_MODEL } from './product';
import type { ProductReading } from './product';
import { getProvider } from './providers';
import { acquireSlot, perMinuteLimit } from './rateLimiter';
import { readSseStream } from './sse';
import type { ModelProfile } from './types';

export interface ProductRecognition {
  /** The answer validated against the schema, or null when the model did not return the JSON asked for. */
  product: ProductReading | null;
  /** The full response text, as a visible fallback when parsing fails. */
  text: string;
  /** End-to-end milliseconds, informational. */
  ms: number;
  /** Which model answered: shown next to the result. */
  model: string;
}

export async function recognizeProduct(options: {
  /** Base64 image, WITHOUT the `data:image/...;base64,` prefix. */
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  /** Defaults to the default product model. The Home selector sets it. */
  model?: ModelProfile;
  /** Called when a slot has to be waited for, with the estimated milliseconds, so it can be announced. */
  onWait?: (waitMs: number) => void;
  signal?: AbortSignal;
}): Promise<ProductRecognition> {
  const model = options.model ?? PRODUCT_MODEL;
  if (!isProviderConfigured(model.provider)) throw new VisionNotConfiguredError();

  const provider = getProvider(model.provider);
  // The provider builds its request as always; the transport decides whether it goes out directly
  // or through the proxy (ADR 0008). With the proxy, `apiKeyFor` returns '' and the headers that
  // would carry it are dropped: the server supplies the key.
  const request = resolveTransport(
    buildProductRequest({
      model,
      apiKey: apiKeyFor(model.provider),
      imageBase64: options.imageBase64,
      mediaType: options.mediaType,
    }),
    model.provider,
  );
  const payloadJson = JSON.stringify(request.body);

  // The quota is honoured BEFORE sending: exhausting it stalls the whole mode. The cap is the one
  // of the chosen model's provider, not a global one — see `perMinuteLimit`.
  //
  // `onWait` exists so the wait can be announced: staying silent while the app sleeps for up to a
  // minute is indistinguishable from being frozen for someone who cannot see the screen.
  await acquireSlot(model.id, {
    signal: options.signal,
    maxPerWindow: perMinuteLimit(model.provider),
    onWait: options.onWait,
  });
  if (options.signal?.aborted) throw new VisionStreamError('cancelled');

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
    if (options.signal?.aborted) throw new VisionStreamError('cancelled');
    throw new VisionNetworkError(err instanceof Error ? err.message : String(err));
  }

  if (!response.ok) {
    // Quota does not always arrive as an SSE event: Groq returns it as a 429 BEFORE opening the
    // stream. Without this interpreter that path threw VisionHttpError and the UI said "the cloud
    // did not answer" instead of "quota exhausted, retry in N s" (measured 2026-09-02).
    throw interpretHttpError(
      response.status,
      await response.text(),
      response.headers.get('retry-after'),
    );
  }
  if (!response.body) {
    throw new VisionStreamError('The response carries no readable body (streaming unsupported?).');
  }

  let text = '';
  let streamError: string | null = null;
  let quotaRetryAfter: number | null = null;

  await readSseStream(response.body, (frame) => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(frame.data) as Record<string, unknown>;
    } catch {
      return; // keep-alives and the `data: [DONE]` Gemini closes with
    }

    const event = provider.readEvent(payload);
    if (!event) return;
    if (event.kind === 'text') text += event.text;
    if (event.kind === 'error') {
      streamError = event.message;
      if (event.code === 'quota_exceeded') quotaRetryAfter = event.retryAfterSeconds ?? 30;
    }
  });

  if (streamError) {
    if (quotaRetryAfter != null) throw new VisionQuotaError(streamError, quotaRetryAfter);
    throw new VisionStreamError(streamError);
  }

  return { product: parseProductReading(text), text, ms: performance.now() - t0, model: model.id };
}
