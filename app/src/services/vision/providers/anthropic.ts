/**
 * Proveedor Anthropic (Messages API). Secundario: requiere crédito con tarjeta (no cumple solo la
 * gratuidad de ADR 0006), así que aparece en el selector de modelo únicamente si el build trae
 * su clave — sirve para contrastar contra otra familia de modelos.
 *
 * Módulo puro: arma y traduce, no toca la red. Ver anthropic.test.ts.
 */
import { ANTHROPIC_MESSAGES_URL, ANTHROPIC_VERSION } from '../config';
import type { BuildRequestInput, ProviderEvent, ProviderRequest, VisionProvider } from '../types';

/**
 * Reglas que este armado respeta — la API responde **400**, no ignora, un parámetro que el modelo
 * no admite:
 *   - `output_config.effort` sólo si el perfil lo soporta (Haiku 4.5 lo rechaza).
 *   - `thinking` se omite por completo en modelos sin thinking adaptativo; no razonar es
 *     justamente el comportamiento que buscamos para latencia mínima.
 *   - `thinking: disabled` sólo se acepta con effort <= high, y por eso EffortLevel corta en high.
 *   - El bloque de imagen va ANTES del de texto (recomendación de la API).
 */
function buildRequest(input: BuildRequestInput): ProviderRequest {
  const outputConfig: Record<string, unknown> = {
    format: { type: 'json_schema', schema: input.schema },
  };
  if (input.model.supportsEffort) {
    outputConfig.effort = input.effort;
  }

  const body: Record<string, unknown> = {
    model: input.model.id,
    max_tokens: input.maxTokens,
    stream: true,
    output_config: outputConfig,
    system: input.prompts.system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 },
          },
          { type: 'text', text: input.prompts.user },
        ],
      },
    ],
  };

  if (input.model.supportsAdaptiveThinking) {
    body.thinking = input.thinking === 'adaptive' ? { type: 'adaptive' } : { type: 'disabled' };
  }

  return {
    url: ANTHROPIC_MESSAGES_URL,
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body,
  };
}

function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const type = typeof payload.type === 'string' ? payload.type : null;

  switch (type) {
    case 'message_start': {
      const message = payload.message as { usage?: { input_tokens: number; output_tokens: number } };
      if (message?.usage) return { kind: 'usage', usage: { ...message.usage } };
      return { kind: 'start' };
    }
    case 'content_block_start': {
      const block = payload.content_block as { type?: string } | undefined;
      return block?.type === 'text' ? { kind: 'text-start' } : null;
    }
    case 'content_block_delta': {
      const delta = payload.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        return { kind: 'text', text: delta.text };
      }
      return null;
    }
    case 'message_delta': {
      // `message_delta` es el ÚNICO evento con el conteo final de tokens de salida; el de
      // `message_start` es el inicial (1-4). Trae sólo `output_tokens`, así que se marca como
      // parcial para que el motor lo fusione en vez de pisar el input ya registrado.
      const delta = payload.delta as { stop_reason?: string } | undefined;
      const usage = payload.usage as { output_tokens?: number } | undefined;
      return {
        kind: 'stop',
        stopReason: delta?.stop_reason,
        usage:
          usage?.output_tokens == null
            ? undefined
            : { input_tokens: 0, output_tokens: usage.output_tokens },
        usageIsPartial: usage?.output_tokens != null,
      };
    }
    case 'message_stop':
      return { kind: 'stop' };
    case 'error': {
      const error = payload.error as { message?: string } | undefined;
      return { kind: 'error', message: error?.message ?? 'error de stream' };
    }
    default:
      return null; // ping y tipos futuros
  }
}

export const anthropicProvider: VisionProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  buildRequest,
  readEvent,
};
