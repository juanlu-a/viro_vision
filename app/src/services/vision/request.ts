/**
 * Armado del cuerpo de la request. Módulo puro y sin dependencias de transporte, para poder
 * testear sin red (ver request.test.ts).
 *
 * Vive separado de anthropicVision.ts porque acá está la lógica delicada: la API responde **400**
 * —no ignora— un parámetro que el modelo no admite, así que el cuerpo no puede ser el mismo para
 * todos los modelos. Un error acá no se ve hasta que falla contra la API real.
 */
import type { ModelProfile } from './config';
import { busReadingSchema } from './schema';
import type { EffortLevel, ThinkingMode } from './types';

export const SYSTEM_PROMPT = [
  'Sos un lector de carteles de ómnibus del transporte metropolitano de Montevideo.',
  'Devolvés únicamente el objeto JSON pedido, con el número de la línea y su nombre.',
  'Si un dato no se lee con claridad en la imagen, ponelo en null en vez de adivinarlo.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

export const USER_PROMPT = 'Leé el número y el nombre de la línea en el cartel de este ómnibus.';

export interface RequestBodyInput {
  profile: ModelProfile;
  maxTokens: number;
  thinking: ThinkingMode;
  effort: EffortLevel;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
}

/**
 * Reglas que este armado respeta:
 *   - `output_config.effort` sólo se manda si el perfil lo soporta (Haiku 4.5 lo rechaza).
 *   - `thinking` se omite por completo en modelos sin thinking adaptativo; no razonar es
 *     justamente el comportamiento que buscamos para latencia mínima.
 *   - `thinking: disabled` sólo se acepta con effort <= high, y por eso EffortLevel corta en high.
 *   - El bloque de imagen va ANTES del de texto (recomendación de la API).
 */
export function buildRequestBody(input: RequestBodyInput): Record<string, unknown> {
  const outputConfig: Record<string, unknown> = {
    format: { type: 'json_schema', schema: busReadingSchema },
  };
  if (input.profile.supportsEffort) {
    outputConfig.effort = input.effort;
  }

  const body: Record<string, unknown> = {
    model: input.profile.id,
    max_tokens: input.maxTokens,
    stream: true,
    output_config: outputConfig,
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

  if (input.profile.supportsAdaptiveThinking) {
    body.thinking = input.thinking === 'adaptive' ? { type: 'adaptive' } : { type: 'disabled' };
  }

  return body;
}
