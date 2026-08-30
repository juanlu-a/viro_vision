import { MODEL_PROFILES, findModelProfile } from '../config';
import { PRODUCTO_PROMPTS, productoSchema } from '../producto';
import type { BuildRequestInput, ModelProfile } from '../types';
import { anthropicProvider, geminiProvider } from './index';

const gemini = findModelProfile('gemini-3.6-flash');
const haiku = findModelProfile('claude-haiku-4-5');
const opus = findModelProfile('claude-opus-5');

function inputFor(model: ModelProfile, overrides: Partial<BuildRequestInput> = {}) {
  return {
    model,
    apiKey: 'clave-de-prueba',
    maxTokens: model.maxTokens,
    thinking: 'off' as const,
    effort: 'low' as const,
    imageBase64: 'QUJD',
    mediaType: 'image/jpeg' as const,
    prompts: PRODUCTO_PROMPTS,
    schema: productoSchema,
    ...overrides,
  };
}

describe('geminiProvider.buildRequest', () => {
  it('pasa la clave por el header x-goog-api-key, no por query string', () => {
    const request = geminiProvider.buildRequest(inputFor(gemini));

    expect(request.headers['x-goog-api-key']).toBe('clave-de-prueba');
    expect(request.url).not.toContain('clave-de-prueba');
  });

  it('pide streaming — sin él no existe el time to first token', () => {
    expect(geminiProvider.buildRequest(inputFor(gemini)).body.stream).toBe(true);
  });

  it('pide JSON con el schema y los prompts que recibe, no con uno propio', () => {
    const body = geminiProvider.buildRequest(inputFor(gemini)).body as {
      response_format: { mime_type: string; schema: unknown };
      input: { type: string; text?: string }[];
    };

    expect(body.response_format.mime_type).toBe('application/json');
    expect(body.response_format.schema).toBe(productoSchema);
    expect(body.input.filter((b) => b.type === 'text').map((b) => b.text)).toEqual([
      PRODUCTO_PROMPTS.system,
      PRODUCTO_PROMPTS.user,
    ]);
  });

  it('manda la imagen con su mime type', () => {
    const { input } = geminiProvider.buildRequest(inputFor(gemini, { mediaType: 'image/png' }))
      .body as { input: { type: string; mime_type?: string; data?: string }[] };
    const image = input.find((block) => block.type === 'image');

    expect(image?.mime_type).toBe('image/png');
    expect(image?.data).toBe('QUJD');
  });
});

/**
 * Payloads capturados de una corrida real contra la API (agosto 2026). No están inventados a
 * partir de los docs a propósito: los docs no muestran que el discriminador sea `event_type`,
 * y leerlo mal descarta todos los eventos en silencio.
 */
const REAL_GEMINI_EVENTS = {
  created: { interaction: { status: 'in_progress' }, event_type: 'interaction.created' },
  statusUpdate: { status: 'in_progress', event_type: 'interaction.status_update' },
  thoughtStart: { index: 0, step: { type: 'thought' }, event_type: 'step.start' },
  thoughtDelta: {
    index: 0,
    delta: { signature: 'Et0ECtoEARFN', type: 'thought_signature' },
    event_type: 'step.delta',
  },
  stepStop: { index: 0, event_type: 'step.stop' },
  outputStart: { index: 1, step: { type: 'model_output' }, event_type: 'step.start' },
  textDelta: {
    index: 1,
    delta: { text: '{\n  "numero": null,\n  "nombre": null\n}', type: 'text' },
    event_type: 'step.delta',
  },
  completed: { event_type: 'interaction.completed' },
};

describe('geminiProvider.readEvent', () => {
  it('lee el discriminador de event_type, no de type', () => {
    // Si leyera `type`, este evento se descartaría y el TTFT quedaría en NaN.
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.textDelta)).toEqual({
      kind: 'text',
      text: '{\n  "numero": null,\n  "nombre": null\n}',
    });
  });

  it('marca el arranque del texto sólo en el paso de salida, no en el de pensamiento', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.outputStart)).toEqual({ kind: 'text-start' });
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.thoughtStart)).toEqual({ kind: 'start' });
  });

  it('no cuenta el delta de pensamiento como texto de respuesta', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.thoughtDelta)).toBeNull();
  });

  it('cierra en interaction.completed', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.completed)).toEqual({ kind: 'stop' });
  });

  it('ignora step.stop y tipos futuros en vez de romper', () => {
    expect(geminiProvider.readEvent(REAL_GEMINI_EVENTS.stepStop)).toBeNull();
    expect(geminiProvider.readEvent({ event_type: 'algo.nuevo.del.futuro' })).toBeNull();
  });

  it('reporta el error de stream', () => {
    const event = geminiProvider.readEvent({
      event_type: 'error',
      error: { message: 'cuota agotada' },
    });

    expect(event).toEqual({ kind: 'error', message: 'cuota agotada' });
  });

  it('recorre la secuencia real completa y produce exactamente un texto y un cierre', () => {
    const kinds = Object.values(REAL_GEMINI_EVENTS)
      .map((payload) => geminiProvider.readEvent(payload))
      .filter((event) => event !== null)
      .map((event) => event.kind);

    expect(kinds.filter((kind) => kind === 'text')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'text-start')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'stop')).toHaveLength(1);
  });
});

describe('anthropicProvider.buildRequest', () => {
  it('usa el schema y los prompts que recibe — el mismo juego que Gemini', () => {
    const body = anthropicProvider.buildRequest(inputFor(haiku)).body as {
      output_config: { format: { type: string; schema: unknown } };
      system: string;
      messages: { content: { type: string; text?: string }[] }[];
    };

    expect(body.output_config.format).toEqual({ type: 'json_schema', schema: productoSchema });
    expect(body.system).toBe(PRODUCTO_PROMPTS.system);
    expect(body.messages[0].content.find((c) => c.type === 'text')?.text).toBe(PRODUCTO_PROMPTS.user);
  });

  it('en Haiku 4.5 NO manda effort — la API lo rechaza con 400', () => {
    const { output_config: outputConfig } = anthropicProvider.buildRequest(inputFor(haiku)).body as {
      output_config: Record<string, unknown>;
    };

    expect(outputConfig).not.toHaveProperty('effort');
  });

  it('en Haiku 4.5 NO manda thinking — el modelo no soporta el adaptativo', () => {
    expect(anthropicProvider.buildRequest(inputFor(haiku)).body).not.toHaveProperty('thinking');
  });

  it('en Haiku 4.5 ignora un pedido de thinking adaptativo en vez de mandar un cuerpo inválido', () => {
    const body = anthropicProvider.buildRequest(inputFor(haiku, { thinking: 'adaptive' })).body;

    expect(body).not.toHaveProperty('thinking');
  });

  it('en Opus 5 sí manda effort y thinking', () => {
    const body = anthropicProvider.buildRequest(inputFor(opus, { thinking: 'adaptive' })).body as {
      output_config: { effort: string };
      thinking: unknown;
    };

    expect(body.output_config.effort).toBe('low');
    expect(body.thinking).toEqual({ type: 'adaptive' });
  });

  it('pone la imagen antes del texto', () => {
    const { messages } = anthropicProvider.buildRequest(inputFor(haiku)).body as {
      messages: { content: { type: string }[] }[];
    };

    expect(messages[0].content.map((block) => block.type)).toEqual(['image', 'text']);
  });
});

describe('anthropicProvider.readEvent', () => {
  it('lee el texto incremental de un content_block_delta', () => {
    const event = anthropicProvider.readEvent({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: '6' },
    });

    expect(event).toEqual({ kind: 'text', text: '6' });
  });

  it('marca el arranque del bloque de texto visible', () => {
    const event = anthropicProvider.readEvent({
      type: 'content_block_start',
      content_block: { type: 'text' },
    });

    expect(event).toEqual({ kind: 'text-start' });
  });

  it('no marca arranque de texto para un bloque de thinking', () => {
    const event = anthropicProvider.readEvent({
      type: 'content_block_start',
      content_block: { type: 'thinking' },
    });

    expect(event).toBeNull();
  });

  it('lee el uso de tokens del message_start', () => {
    const event = anthropicProvider.readEvent({
      type: 'message_start',
      message: { usage: { input_tokens: 1200, output_tokens: 0 } },
    });

    expect(event).toEqual({ kind: 'usage', usage: { input_tokens: 1200, output_tokens: 0 } });
  });

  it('ignora el ping', () => {
    expect(anthropicProvider.readEvent({ type: 'ping' })).toBeNull();
  });
});

describe('registro de modelos', () => {
  it('cada perfil apunta a un proveedor existente', () => {
    for (const profile of MODEL_PROFILES) {
      expect(['gemini', 'anthropic']).toContain(profile.provider);
    }
  });

  it('el primer modelo del registro es de Gemini — el gratuito y de la familia de Gemma', () => {
    expect(MODEL_PROFILES[0].provider).toBe('gemini');
  });
});

describe('error de cuota de Gemini', () => {
  // Payload real capturado de la API tras superar el límite del tier gratuito.
  const REAL_QUOTA_ERROR = {
    event_type: 'error',
    error: {
      code: 'quota_exceeded',
      message:
        'You exceeded your current quota, please check your plan and billing details. ' +
        '* Quota exceeded for metric: generativelanguage.googleapis.com/' +
        'generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\n' +
        'Please retry in 29.220629527s.',
    },
  };

  it('lo distingue por código para poder reintentar en vez de abortar la serie', () => {
    const event = geminiProvider.readEvent(REAL_QUOTA_ERROR);

    expect(event?.kind).toBe('error');
    expect(event).toMatchObject({ code: 'quota_exceeded' });
  });

  it('extrae del mensaje cuántos segundos esperar, redondeando hacia arriba', () => {
    const event = geminiProvider.readEvent(REAL_QUOTA_ERROR);

    // Aprovechar el dato que da la API evita inventar un backoff arbitrario.
    expect(event).toMatchObject({ retryAfterSeconds: 30 });
  });

  it('un error sin espera sugerida no inventa una', () => {
    const event = geminiProvider.readEvent({
      event_type: 'error',
      error: { message: 'algo se rompió' },
    });

    expect(event).toMatchObject({ kind: 'error', retryAfterSeconds: undefined });
  });
});
