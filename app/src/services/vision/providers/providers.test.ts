import { MODEL_PROFILES, findModelProfile } from '../config';
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

  it('pide JSON con el schema de dos campos', () => {
    const { response_format: format } = geminiProvider.buildRequest(inputFor(gemini)).body as {
      response_format: { mime_type: string; schema: { required: readonly string[] } };
    };

    expect(format.mime_type).toBe('application/json');
    expect(format.schema.required).toEqual(['numero', 'nombre']);
  });

  it('manda la imagen con su mime type', () => {
    const { input } = geminiProvider.buildRequest(inputFor(gemini, { mediaType: 'image/png' }))
      .body as { input: { type: string; mime_type?: string; data?: string }[] };
    const image = input.find((block) => block.type === 'image');

    expect(image?.mime_type).toBe('image/png');
    expect(image?.data).toBe('QUJD');
  });
});

describe('geminiProvider.readEvent', () => {
  it('lee el texto incremental de un step.delta', () => {
    const event = geminiProvider.readEvent({ type: 'step.delta', delta: { type: 'text', text: '11' } });

    expect(event).toEqual({ kind: 'text', text: '11' });
  });

  it('ignora un step.delta que no sea de texto', () => {
    expect(geminiProvider.readEvent({ type: 'step.delta', delta: { type: 'thought' } })).toBeNull();
  });

  it('reporta el error de stream', () => {
    const event = geminiProvider.readEvent({ type: 'error', error: { message: 'cuota agotada' } });

    expect(event).toEqual({ kind: 'error', message: 'cuota agotada' });
  });

  it('ignora tipos desconocidos en vez de romper', () => {
    expect(geminiProvider.readEvent({ type: 'algo.nuevo.del.futuro' })).toBeNull();
  });
});

describe('anthropicProvider.buildRequest', () => {
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
