import { MODEL_PROFILES, findModelProfile } from './config';
import { buildRequestBody } from './request';
import type { RequestBodyInput } from './request';

const haiku = findModelProfile('claude-haiku-4-5');
const opus = findModelProfile('claude-opus-5');

function inputFor(profile: typeof haiku, overrides: Partial<RequestBodyInput> = {}) {
  return {
    profile,
    maxTokens: profile.maxTokens,
    thinking: 'off' as const,
    effort: 'low' as const,
    imageBase64: 'QUJD',
    mediaType: 'image/jpeg' as const,
    ...overrides,
  };
}

describe('buildRequestBody', () => {
  it('en Haiku 4.5 NO manda effort — la API lo rechaza con 400', () => {
    const body = buildRequestBody(inputFor(haiku));
    const outputConfig = body.output_config as Record<string, unknown>;

    expect(outputConfig).not.toHaveProperty('effort');
  });

  it('en Haiku 4.5 NO manda thinking — el modelo no soporta el adaptativo', () => {
    expect(buildRequestBody(inputFor(haiku))).not.toHaveProperty('thinking');
  });

  it('en Haiku 4.5 ignora un pedido de thinking adaptativo en vez de mandar un cuerpo inválido', () => {
    expect(buildRequestBody(inputFor(haiku, { thinking: 'adaptive' }))).not.toHaveProperty(
      'thinking',
    );
  });

  it('en Opus 5 sí manda effort', () => {
    const body = buildRequestBody(inputFor(opus));

    expect((body.output_config as Record<string, unknown>).effort).toBe('low');
  });

  it('en Opus 5 traduce thinking off a disabled', () => {
    expect(buildRequestBody(inputFor(opus)).thinking).toEqual({ type: 'disabled' });
  });

  it('en Opus 5 traduce thinking adaptive', () => {
    expect(buildRequestBody(inputFor(opus, { thinking: 'adaptive' })).thinking).toEqual({
      type: 'adaptive',
    });
  });

  it('siempre pide structured output con el schema de dos campos', () => {
    const body = buildRequestBody(inputFor(haiku));
    const { format } = body.output_config as {
      format: { type: string; schema: { required: readonly string[] } };
    };

    expect(format.type).toBe('json_schema');
    expect(format.schema.required).toEqual(['numero', 'nombre']);
  });

  it('siempre pide streaming — sin él no existe el time to first token', () => {
    expect(buildRequestBody(inputFor(haiku)).stream).toBe(true);
  });

  it('pone la imagen antes del texto', () => {
    const body = buildRequestBody(inputFor(haiku));
    const content = (body.messages as { content: { type: string }[] }[])[0].content;

    expect(content.map((block) => block.type)).toEqual(['image', 'text']);
  });

  it('usa el media type recibido', () => {
    const body = buildRequestBody(inputFor(haiku, { mediaType: 'image/png' }));
    const content = (
      body.messages as { content: { source?: { media_type: string } }[] }[]
    )[0].content;

    expect(content[0].source?.media_type).toBe('image/png');
  });
});

describe('findModelProfile', () => {
  it('encuentra cada perfil declarado', () => {
    for (const profile of MODEL_PROFILES) {
      expect(findModelProfile(profile.id).id).toBe(profile.id);
    }
  });

  it('cae al modelo por defecto (el más rápido) ante un id desconocido', () => {
    expect(findModelProfile('modelo-inexistente').id).toBe('claude-haiku-4-5');
  });
});
