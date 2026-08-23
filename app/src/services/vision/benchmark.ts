/**
 * Motor del benchmark de latencia contra un modelo de visión en la nube.
 *
 * Mide, sobre una foto de ómnibus real: tiempo hasta headers, hasta el primer byte, hasta el
 * primer evento, hasta el primer token de la respuesta (TTFT — la métrica que pidió el tutor)
 * y total. Habla HTTP crudo con streaming SSE sobre `expo/fetch`; ver sse.ts para el porqué.
 *
 * Es agnóstico del proveedor: los timestamps se toman acá y sólo acá, así que los números de
 * Gemini y de Anthropic son comparables por construcción.
 *
 * REGLA DE FRONTERA (ADR 0001, nota 2026-08-10): esto es instrumentación de desarrollo. La nube
 * es un acelerador opcional y lo local es el fallback garantizado — este módulo NUNCA debe
 * llamarse desde el camino cámara → detección/OCR → anuncio, que tiene que funcionar sin internet.
 */
import { fetch } from 'expo/fetch';

import { apiKeyFor, defaultModel, findModelProfile, isProviderConfigured } from './config';
import {
  VisionHttpError,
  VisionNotConfiguredError,
  VisionQuotaError,
  VisionStreamError,
} from './errors';
import { getProvider } from './providers';
import { acquireSlot } from './rateLimiter';
import { parseBusReading } from './schema';
import { readSseStream } from './sse';
import type {
  BenchmarkOptions,
  BenchmarkResult,
  EffortLevel,
  LatencyMarks,
  LatencyMs,
  ThinkingMode,
  TokenUsage,
} from './types';

/**
 * Corre una medición. Lanza si falta la clave, si la API responde error, o si el stream falla.
 *
 * Higiene: la primera llamada del día paga handshake TLS y, en algunos proveedores, compilación
 * del schema. Descartá siempre una corrida de calentamiento (lo hace el hook).
 */
export async function benchmarkBusVision(options: BenchmarkOptions): Promise<BenchmarkResult> {
  const model = options.model ? findModelProfile(options.model) : defaultModel();
  if (!isProviderConfigured(model.provider)) throw new VisionNotConfiguredError();

  const provider = getProvider(model.provider);
  // Un modelo que no soporta thinking adaptativo se fuerza a 'off': pedirlo daría 400.
  const requested: ThinkingMode = options.thinking ?? 'off';
  const thinking: ThinkingMode = model.supportsAdaptiveThinking ? requested : 'off';
  const effort: EffortLevel = options.effort ?? 'low';
  const maxTokens = options.maxTokens ?? (thinking === 'adaptive' ? 4096 : model.maxTokens);

  const request = provider.buildRequest({
    model,
    apiKey: apiKeyFor(model.provider),
    maxTokens,
    thinking,
    effort,
    imageBase64: options.imageBase64,
    mediaType: options.mediaType,
  });

  // Serializar ANTES de marcar el envío: en una foto de varios MB, stringify come decenas de ms
  // de hilo JS que si no quedarían contabilizados como latencia de red.
  const payloadJson = JSON.stringify(request.body);

  // Respetar la cuota ANTES de arrancar el cronómetro. Si esperáramos con la medición ya iniciada,
  // la espera se contaría como latencia del modelo y el número sería basura.
  await acquireSlot(model.id, { onWait: options.onQuotaWait, signal: options.signal });
  if (options.signal?.aborted) throw new VisionStreamError('cancelado');

  const startedAtEpoch = Date.now();
  const marks: LatencyMarks = { requestSentAt: performance.now() };
  const eventCounts: Record<string, number> = {};

  let textBuffer = '';
  let usage: TokenUsage | null = null;
  let stopReason: string | null = null;
  let streamError: string | null = null;
  let quotaRetryAfter: number | null = null;

  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: payloadJson,
    signal: options.signal,
  });
  marks.headersAt = performance.now();

  if (!response.ok) {
    throw new VisionHttpError(response.status, await response.text());
  }
  if (!response.body) {
    throw new VisionStreamError('La respuesta no trae body legible (¿streaming no soportado?).');
  }

  await readSseStream(
    response.body,
    (frame, receivedAt) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(frame.data) as Record<string, unknown>;
      } catch {
        // Frames no-JSON: keep-alives y el `data: [DONE]` con que cierra Gemini.
        return;
      }

      const event = provider.readEvent(payload);
      // El nombre del tipo vive en `type` (Anthropic) o `event_type` (Gemini); si no, la línea
      // `event:` del propio SSE alcanza para el conteo.
      const label =
        (typeof payload.type === 'string' ? payload.type : null) ??
        (typeof payload.event_type === 'string' ? payload.event_type : null) ??
        frame.event ??
        'unknown';
      eventCounts[label] = (eventCounts[label] ?? 0) + 1;
      // Cualquier evento reconocido sirve para marcar "el servidor empezó a responder".
      if (event) marks.firstEventAt ??= receivedAt;
      if (!event) return;

      switch (event.kind) {
        case 'text-start':
          marks.firstTextBlockAt ??= receivedAt;
          break;
        case 'text':
          marks.firstTextDeltaAt ??= receivedAt;
          marks.firstTextBlockAt ??= receivedAt;
          textBuffer += event.text;
          options.onTextDelta?.(event.text);
          break;
        case 'usage':
          usage = event.usage;
          break;
        case 'stop':
          if (event.stopReason) stopReason = event.stopReason;
          if (event.usage) {
            // Un usage parcial (Anthropic manda sólo output_tokens al cerrar) se fusiona con el
            // input ya registrado; pisarlo dejaría input_tokens en cero.
            usage =
              event.usageIsPartial && usage
                ? { ...usage, output_tokens: event.usage.output_tokens }
                : event.usage;
          }
          // Asignación, no `??=`: los proveedores emiten más de un evento terminal y queremos el
          // ÚLTIMO. Con `??=` Anthropic latcheaba en `message_delta` — un frame antes de
          // `message_stop` — y Gemini en el suyo, midiendo cosas distintas bajo el mismo nombre.
          marks.doneAt = receivedAt;
          break;
        case 'error':
          streamError = event.message;
          if (event.code === 'quota_exceeded') quotaRetryAfter = event.retryAfterSeconds ?? 30;
          break;
        case 'start':
        default:
          break;
      }
    },
    { onFirstByte: (at) => (marks.firstByteAt = at) },
  );

  marks.doneAt ??= performance.now();

  if (streamError) {
    if (quotaRetryAfter != null) throw new VisionQuotaError(streamError, quotaRetryAfter);
    throw new VisionStreamError(streamError);
  }

  return {
    marks,
    ms: toDurations(marks),
    eventCounts,
    usage,
    stopReason,
    text: textBuffer,
    parsed: parseBusReading(textBuffer),
    imageBase64Bytes: options.imageBase64.length,
    model: model.id,
    provider: model.provider,
    thinking,
    effort,
    startedAtEpoch,
  };
}

function toDurations(marks: LatencyMarks): LatencyMs {
  const since = (at: number | undefined) => (at == null ? NaN : at - marks.requestSentAt);
  return {
    toHeaders: since(marks.headersAt),
    toFirstByte: since(marks.firstByteAt),
    toFirstEvent: since(marks.firstEventAt),
    toFirstTextBlock: since(marks.firstTextBlockAt),
    toFirstTextDelta: since(marks.firstTextDeltaAt),
    total: since(marks.doneAt),
  };
}
