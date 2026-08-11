/**
 * Proveedor Gemini (Interactions API). Primario del benchmark: tier gratuito sin tarjeta, y de la
 * misma familia que Gemma, así que la comparación local vs. nube cambia una sola variable.
 *
 * Forma verificada CONTRA LA API REAL (agosto 2026), no sólo contra los docs:
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   header  x-goog-api-key
 *   body    { model, input: [...], stream: true, response_format: {...} }
 *
 * El discriminador de los eventos es **`event_type`**, no `type` — los docs no lo muestran y
 * leerlo mal descarta todos los eventos en silencio (cero texto, TTFT en NaN). La secuencia real:
 *
 *   interaction.created → interaction.status_update
 *   step.start { step: { type: 'thought' } }          ← el modelo piensa primero
 *   step.delta { delta: { type: 'thought_signature' } }
 *   step.stop
 *   step.start { step: { type: 'model_output' } }     ← acá arranca el texto visible
 *   step.delta { delta: { type: 'text', text } }      ← TTFT
 *   step.stop → interaction.completed
 *
 * Que haya un paso de "thought" antes del texto significa que el TTFT de Gemini lo incluye; por
 * eso el benchmark mide por separado el arranque del bloque de texto y el primer token.
 *
 * Módulo puro: arma y traduce, no toca la red. Ver providers.test.ts.
 */
import { GEMINI_INTERACTIONS_URL } from '../config';
import { busReadingSchema } from '../schema';
import type {
  BuildRequestInput,
  ProviderEvent,
  ProviderRequest,
  TokenUsage,
  VisionProvider,
} from '../types';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompts';

function buildRequest(input: BuildRequestInput): ProviderRequest {
  return {
    url: GEMINI_INTERACTIONS_URL,
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': input.apiKey,
    },
    body: {
      model: input.model.id,
      stream: true,
      // La instrucción de sistema va como primer bloque de texto: la Interactions API recibe
      // todo en un único `input`, sin campo `system` separado.
      input: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'image', data: input.imageBase64, mime_type: input.mediaType },
        { type: 'text', text: USER_PROMPT },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: busReadingSchema,
      },
    },
  };
}

/** El discriminador real es `event_type`; se acepta `type` como respaldo por si vuelve a cambiar. */
export function eventTypeOf(payload: Record<string, unknown>): string | null {
  if (typeof payload.event_type === 'string') return payload.event_type;
  if (typeof payload.type === 'string') return payload.type;
  return null;
}

function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const type = eventTypeOf(payload);

  switch (type) {
    case 'step.start': {
      // Sólo el paso de salida marca el arranque del texto visible; el de 'thought' no.
      const step = payload.step as { type?: string } | undefined;
      return step?.type === 'model_output' ? { kind: 'text-start' } : { kind: 'start' };
    }
    case 'step.delta': {
      const delta = payload.delta as { type?: string; text?: string } | undefined;
      // Los deltas del paso de pensamiento son 'thought_signature' y no cuentan como respuesta.
      if (delta?.type === 'text' && typeof delta.text === 'string') {
        return { kind: 'text', text: delta.text };
      }
      return null;
    }
    case 'interaction.completed':
      // Siempre es un cierre, con o sin uso adjunto. Devolver sólo el uso perdería la marca de
      // cierre y el total se mediría contra el fin del stream, inflado por transporte.
      return { kind: 'stop', usage: readUsage(payload) };
    case 'interaction.failed':
    case 'error': {
      const error = payload.error as { message?: string; code?: string } | undefined;
      const message = error?.message ?? 'error de stream';
      // El error de cuota trae en el propio texto cuánto esperar ("Please retry in 29.2s").
      // Aprovecharlo evita adivinar un backoff.
      const match = /retry in ([\d.]+)s/i.exec(message);
      return {
        kind: 'error',
        message,
        code: error?.code,
        retryAfterSeconds: match ? Math.ceil(Number(match[1])) : undefined,
      };
    }
    case 'interaction.created':
    case 'interaction.status_update':
      return { kind: 'start' };
    default:
      return null; // step.stop y tipos futuros
  }
}

/** El uso de tokens puede venir en el evento de cierre; su ubicación exacta varía por versión. */
function readUsage(payload: Record<string, unknown>): TokenUsage | undefined {
  const usage = (payload.usage ?? payload.usage_metadata) as
    | Record<string, number | undefined>
    | undefined;
  if (!usage) return undefined;

  const input = usage.input_tokens ?? usage.prompt_token_count ?? usage.promptTokenCount;
  const output = usage.output_tokens ?? usage.candidates_token_count ?? usage.candidatesTokenCount;
  if (input == null && output == null) return undefined;

  return { input_tokens: input ?? 0, output_tokens: output ?? 0 };
}

export const geminiProvider: VisionProvider = {
  id: 'gemini',
  label: 'Gemini',
  buildRequest,
  readEvent,
};
