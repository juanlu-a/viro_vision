/**
 * Proveedor Gemini (Interactions API). Primario del benchmark: tier gratuito sin tarjeta, y de la
 * misma familia que Gemma, así que la comparación local vs. nube cambia una sola variable.
 *
 * Forma verificada contra los docs de la Gemini API (agosto 2026):
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   header  x-goog-api-key
 *   body    { model, input: [...], stream: true, response_format: {...} }
 *   SSE     eventos `step.delta` con { delta: { type: 'text', text } }, cierra con data: [DONE]
 *
 * Módulo puro: arma y traduce, no toca la red. Ver gemini.test.ts.
 */
import { GEMINI_INTERACTIONS_URL } from '../config';
import { busReadingSchema } from '../schema';
import type { BuildRequestInput, ProviderEvent, ProviderRequest, VisionProvider } from '../types';
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

function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const type = typeof payload.type === 'string' ? payload.type : null;

  if (type === 'step.delta') {
    const delta = payload.delta as { type?: string; text?: string } | undefined;
    if (delta?.type === 'text' && typeof delta.text === 'string') {
      return { kind: 'text', text: delta.text };
    }
    return null;
  }

  if (type === 'error') {
    const error = payload.error as { message?: string } | undefined;
    return { kind: 'error', message: error?.message ?? 'error de stream' };
  }

  // El primer evento del stream, cualquiera sea, marca "hubo respuesta del servidor".
  if (type?.startsWith('interaction.') || type === 'step.start') {
    return { kind: 'start' };
  }

  if (type === 'interaction.completed' || type === 'done') {
    const usage = readUsage(payload);
    return usage ?? { kind: 'stop' };
  }

  return null;
}

/** El uso de tokens puede venir en el evento de cierre; su ubicación exacta varía por versión. */
function readUsage(payload: Record<string, unknown>): ProviderEvent | null {
  const usage = (payload.usage ?? payload.usage_metadata) as
    | Record<string, number | undefined>
    | undefined;
  if (!usage) return null;

  const input = usage.input_tokens ?? usage.prompt_token_count ?? usage.promptTokenCount;
  const output = usage.output_tokens ?? usage.candidates_token_count ?? usage.candidatesTokenCount;
  if (input == null && output == null) return null;

  return { kind: 'usage', usage: { input_tokens: input ?? 0, output_tokens: output ?? 0 } };
}

export const geminiProvider: VisionProvider = {
  id: 'gemini',
  label: 'Gemini',
  buildRequest,
  readEvent,
};
