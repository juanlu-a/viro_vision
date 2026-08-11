/**
 * Benchmark de latencia contra un modelo de visión en la nube (Claude, Messages API).
 *
 * Mide, sobre una foto de ómnibus real: tiempo hasta headers, hasta el primer byte, hasta el
 * primer evento, hasta el primer token de la respuesta (TTFT — la métrica que pidió el tutor)
 * y total. Habla HTTP crudo con streaming SSE sobre `expo/fetch`; ver sse.ts para el porqué.
 *
 * REGLA DE FRONTERA (ADR 0001, nota 2026-08-10): esto es instrumentación de desarrollo. La nube
 * es un acelerador opcional y lo local es el fallback garantizado — este módulo NUNCA debe
 * llamarse desde el camino cámara → detección/OCR → anuncio, que tiene que funcionar sin internet.
 */
import { fetch } from 'expo/fetch';

import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  VISION_MODEL,
  anthropicApiKey,
  isAnthropicConfigured,
} from './config';
import { busReadingSchema, parseBusReading } from './schema';
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

/** Se lanza cuando falta EXPO_PUBLIC_ANTHROPIC_API_KEY (ver app/.env.example). */
export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_NOT_CONFIGURED');
    this.name = 'AnthropicNotConfiguredError';
  }
}

/** Se lanza ante una respuesta HTTP no-2xx. `body` trae el detalle de la API. */
export class AnthropicHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`ANTHROPIC_HTTP_${status}`);
    this.name = 'AnthropicHttpError';
    this.status = status;
    this.body = body;
  }
}

/** Se lanza ante un `event: error` a mitad de stream (llega con HTTP 200). */
export class AnthropicStreamError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('ANTHROPIC_STREAM_ERROR');
    this.name = 'AnthropicStreamError';
    this.detail = detail;
  }
}

const SYSTEM_PROMPT = [
  'Sos un lector de carteles de ómnibus del transporte metropolitano de Montevideo.',
  'Respondé solo con el objeto JSON pedido.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

const USER_PROMPT = 'Leé el número de línea y el destino del cartel frontal de este ómnibus.';

/**
 * Corre una medición. Lanza si la clave falta, si la API responde error, o si el stream falla.
 *
 * Nota de higiene: la primera llamada del día paga handshake TLS y compilación del JSON Schema
 * (que se cachea 24 h). Descartá siempre una corrida de calentamiento.
 */
export async function benchmarkBusVision(options: BenchmarkOptions): Promise<BenchmarkResult> {
  if (!isAnthropicConfigured) throw new AnthropicNotConfiguredError();

  const thinking: ThinkingMode = options.thinking ?? 'off';
  const effort: EffortLevel = options.effort ?? 'low';
  const model = options.model ?? VISION_MODEL;
  const maxTokens = options.maxTokens ?? (thinking === 'off' ? 512 : 4096);

  const body = buildRequestBody({
    model,
    maxTokens,
    thinking,
    effort,
    imageBase64: options.imageBase64,
    mediaType: options.mediaType,
  });

  const startedAtEpoch = Date.now();
  const marks: LatencyMarks = { requestSentAt: performance.now() };
  const eventCounts: Record<string, number> = {};

  let textBuffer = '';
  let usage: TokenUsage | null = null;
  let stopReason: string | null = null;
  let streamError: string | null = null;

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  marks.headersAt = performance.now();

  if (!response.ok) {
    throw new AnthropicHttpError(response.status, await response.text());
  }
  if (!response.body) {
    throw new AnthropicStreamError('La respuesta no trae body legible (¿streaming no soportado?).');
  }

  await readSseStream(
    response.body,
    (frame, receivedAt) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(frame.data) as Record<string, unknown>;
      } catch {
        return; // frame no-JSON (keep-alive): se ignora
      }

      const type = typeof payload.type === 'string' ? payload.type : (frame.event ?? 'unknown');
      eventCounts[type] = (eventCounts[type] ?? 0) + 1;

      switch (type) {
        case 'message_start': {
          marks.firstEventAt ??= receivedAt;
          const message = payload.message as { usage?: TokenUsage } | undefined;
          if (message?.usage) usage = { ...message.usage };
          break;
        }
        case 'content_block_start': {
          const block = payload.content_block as { type?: string } | undefined;
          if (block?.type === 'text') marks.firstTextBlockAt ??= receivedAt;
          break;
        }
        case 'content_block_delta': {
          const delta = payload.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            marks.firstTextDeltaAt ??= receivedAt;
            textBuffer += delta.text;
            options.onTextDelta?.(delta.text);
          }
          break;
        }
        case 'message_delta': {
          const delta = payload.delta as { stop_reason?: string } | undefined;
          if (delta?.stop_reason) stopReason = delta.stop_reason;
          const deltaUsage = payload.usage as Partial<TokenUsage> | undefined;
          if (deltaUsage?.output_tokens != null && usage) {
            usage = { ...usage, output_tokens: deltaUsage.output_tokens };
          }
          break;
        }
        case 'message_stop': {
          marks.doneAt ??= receivedAt;
          break;
        }
        case 'error': {
          const error = payload.error as { message?: string } | undefined;
          streamError = error?.message ?? frame.data;
          break;
        }
        default:
          break; // ping y tipos futuros
      }
    },
    { onFirstByte: (at) => (marks.firstByteAt = at) },
  );

  marks.doneAt ??= performance.now();

  if (streamError) throw new AnthropicStreamError(streamError);

  return {
    marks,
    ms: toDurations(marks),
    eventCounts,
    usage,
    stopReason,
    text: textBuffer,
    parsed: parseBusReading(textBuffer),
    imageBase64Bytes: options.imageBase64.length,
    model,
    thinking,
    effort,
    startedAtEpoch,
  };
}

interface RequestBodyInput {
  model: string;
  maxTokens: number;
  thinking: ThinkingMode;
  effort: EffortLevel;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
}

/**
 * Arma el cuerpo del POST. Exportada para poder inspeccionarla en tests sin tocar la red.
 *
 * El bloque de imagen va ANTES del de texto (recomendación de la API). `thinking: disabled`
 * sólo se acepta con effort <= high; por eso EffortLevel no incluye xhigh ni max.
 */
export function buildRequestBody(input: RequestBodyInput): Record<string, unknown> {
  return {
    model: input.model,
    max_tokens: input.maxTokens,
    stream: true,
    thinking: input.thinking === 'off' ? { type: 'disabled' } : { type: 'adaptive' },
    output_config: {
      effort: input.effort,
      format: { type: 'json_schema', schema: busReadingSchema },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
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
