import { MODEL_PROFILES, findModelProfile } from '../config';
import { PRODUCTO_PROMPTS, productoSchema } from '../producto';
import type { BuildRequestInput, ModelProfile } from '../types';
import { anthropicProvider, geminiProvider, getProvider, groqProvider, openaiProvider } from './index';

const gemini = findModelProfile('gemini-3.5-flash-lite');
const haiku = findModelProfile('claude-haiku-4-5');
/**
 * Perfil sintético, no del registro: `claude-opus-5` salió del selector el 2026-09-01 (ADR 0006),
 * pero las dos ramas de capacidad del proveedor —mandar `effort` y mandar `thinking`— siguen
 * existiendo en el código y hay que cubrirlas. Atarlas a un modelo concreto del registro las hacía
 * romperse cada vez que cambia la lista, que es una razón ajena a lo que el test verifica.
 */
const conThinking: ModelProfile = {
  ...findModelProfile('claude-haiku-4-5'),
  id: 'modelo-con-thinking',
  supportsEffort: true,
  supportsAdaptiveThinking: true,
};

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

  it('apaga el pensamiento: sin thinking_level la lectura pasa de 2-3 s a decenas de segundos', () => {
    const { generation_config: gc } = geminiProvider.buildRequest(inputFor(gemini)).body as {
      generation_config: { thinking_level: string; max_output_tokens: number };
    };

    // 'minimal' es el piso que aceptan los Flash Lite; los Flash grandes lo rechazan con 400.
    expect(gc.thinking_level).toBe('minimal');
    expect(gc.max_output_tokens).toBe(gemini.maxTokens);
  });

  it('con thinking adaptativo manda el effort como nivel, no un valor inventado', () => {
    const { generation_config: gc } = geminiProvider.buildRequest(
      inputFor(gemini, { thinking: 'adaptive', effort: 'medium' }),
    ).body as { generation_config: { thinking_level: string } };

    expect(gc.thinking_level).toBe('medium');
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

  it('en un modelo que los soporta sí manda effort y thinking', () => {
    const body = anthropicProvider.buildRequest(inputFor(conThinking, { thinking: 'adaptive' })).body as {
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
  it('cada perfil apunta a un proveedor con implementación', () => {
    for (const profile of MODEL_PROFILES) {
      expect(getProvider(profile.provider)).toBeDefined();
      expect(getProvider(profile.provider).id).toBe(profile.provider);
    }
  });

  it('no ofrece dos modelos del mismo proveedor', () => {
    // El selector es un radiogroup que se recorre con VoiceOver: cada opción de más es un swipe
    // más entre la persona y la lectura, y dos escalones de la misma familia no aportan una
    // comparación distinta. Por eso salieron `gemini-flash-lite-latest` y `claude-opus-5`
    // (ADR 0006, actualización 2026-09-01). Si este test cae, la decisión hay que rediscutirla,
    // no ajustarla.
    const proveedores = MODEL_PROFILES.map((profile) => profile.provider);

    expect(new Set(proveedores).size).toBe(proveedores.length);
  });

  it('el primer modelo del registro es de Gemini — el gratuito y de la familia de Gemma', () => {
    expect(MODEL_PROFILES[0].provider).toBe('gemini');
  });

  it('de Gemini sólo hay Flash Lite: los Flash grandes miden 17-47 s por lectura', () => {
    // Si alguien vuelve a agregar un Flash grande, este test cae y hay que revisar dos cosas: la
    // latencia (medición del 30/08/2026, ver config.ts) y el piso de thinking_level, que en esos
    // modelos no es 'minimal' sino 'low' — mandarles 'minimal' es un 400.
    const gemini = MODEL_PROFILES.filter((profile) => profile.provider === 'gemini');

    expect(gemini.length).toBeGreaterThan(0);
    for (const profile of gemini) expect(profile.id).toContain('lite');
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

/**
 * El dialecto de OpenAI cubre DOS proveedores del selector (OpenAI y Groq) y, el día que haya
 * endpoint, el modelo que hosteemos nosotros (ADR 0008). Un error acá rompe la mitad del selector
 * de una vez, así que se testea la forma que la API rechaza con 400 y la que devuelve texto vacío
 * en silencio — que es la falla cara, porque no se ve.
 */
describe('proveedores de dialecto OpenAI (buildRequest)', () => {
  const luna = findModelProfile('gpt-5.6-luna');
  const qwen = findModelProfile('qwen/qwen3.8-27b');

  it('OpenAI y Groq son el mismo dialecto apuntando a distinta URL', () => {
    const deOpenai = openaiProvider.buildRequest(inputFor(luna));
    const deGroq = groqProvider.buildRequest(inputFor(qwen));

    expect(deOpenai.url).toContain('api.openai.com');
    expect(deGroq.url).toContain('api.groq.com');
    // Misma forma de cuerpo: si dejan de coincidir, dejaron de ser el mismo proveedor.
    expect(Object.keys(deOpenai.body).sort()).toEqual(Object.keys(deGroq.body).sort());
  });

  it('apaga el razonamiento — es lo que decide la latencia del modo', () => {
    // `gpt-5.6-luna` razona en `medium` por defecto: sin esto, tres campos cortos se pagarían como
    // decenas de segundos. Es la misma trampa que en Gemini con `thinking_level`.
    expect(openaiProvider.buildRequest(inputFor(luna)).body.reasoning_effort).toBe('none');
    expect(groqProvider.buildRequest(inputFor(qwen)).body.reasoning_effort).toBe('none');
  });

  it('pasa la clave como Bearer, no por query string', () => {
    const request = openaiProvider.buildRequest(inputFor(luna));

    expect(request.headers.authorization).toBe('Bearer clave-de-prueba');
    expect(request.url).not.toContain('clave-de-prueba');
  });

  it('usa max_completion_tokens: max_tokens está deprecado y los modelos de razonamiento lo rechazan', () => {
    const body = openaiProvider.buildRequest(inputFor(luna)).body;

    expect(body.max_completion_tokens).toBe(luna.maxTokens);
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('pide el schema con strict, no json_object', () => {
    // `json_object` sólo garantiza JSON sintáctico: los nombres de campo quedan a criterio del
    // modelo, y `parseProductoLeido` rebotaría una lectura correcta por venir como "producto" en
    // vez de "tipo". `strict` hace decodificación restringida: no *puede* devolver otra forma.
    const { response_format: rf } = openaiProvider.buildRequest(inputFor(luna)).body as {
      response_format: { type: string; json_schema: { schema: unknown; strict: boolean } };
    };

    expect(rf.type).toBe('json_schema');
    expect(rf.json_schema.strict).toBe(true);
    expect(rf.json_schema.schema).toBe(productoSchema);
  });

  it('manda la imagen como data URI con su mime type, y usa los prompts que recibe', () => {
    const { messages } = openaiProvider.buildRequest(inputFor(luna, { mediaType: 'image/png' }))
      .body as {
      messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[];
    };

    expect(messages[0]).toEqual({ role: 'system', content: PRODUCTO_PROMPTS.system });
    const partes = messages[1].content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(partes[0].image_url?.url).toBe('data:image/png;base64,QUJD');
    expect(partes[1].text).toBe(PRODUCTO_PROMPTS.user);
  });

  it('pide el uso de tokens en el stream: sin stream_options no llega en ningún evento', () => {
    expect(openaiProvider.buildRequest(inputFor(luna)).body.stream).toBe(true);
    expect(openaiProvider.buildRequest(inputFor(luna)).body.stream_options).toEqual({
      include_usage: true,
    });
  });
});

describe('proveedores de dialecto OpenAI (readEvent)', () => {
  it('lee el texto incremental del delta', () => {
    expect(
      openaiProvider.readEvent({ choices: [{ index: 0, delta: { content: '{"tipo"' } }] }),
    ).toEqual({ kind: 'text', text: '{"tipo"' });
  });

  it('trata el primer delta (sólo role) como arranque del texto, no como texto vacío', () => {
    expect(
      openaiProvider.readEvent({ choices: [{ index: 0, delta: { role: 'assistant' } }] }),
    ).toEqual({ kind: 'text-start' });
  });

  it('cierra en finish_reason', () => {
    expect(
      openaiProvider.readEvent({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }),
    ).toMatchObject({ kind: 'stop', stopReason: 'stop' });
  });

  it('lee el uso del frame final, que viene con choices vacío', () => {
    // Es el frame que habilita `stream_options.include_usage`. Si se descartara por no tener
    // choices, el uso de tokens quedaría siempre en cero sin que nada falle a la vista.
    expect(
      openaiProvider.readEvent({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 42 } }),
    ).toEqual({ kind: 'stop', usage: { input_tokens: 1200, output_tokens: 42 } });
  });

  it('normaliza el error de cuota al código que el motor ya entiende, con los segundos del mensaje', () => {
    // Aprovechar el dato que da la API evita inventar un backoff arbitrario — mismo criterio que
    // con el "Please retry in 29.2s" de Gemini.
    const event = groqProvider.readEvent({
      error: {
        code: 'rate_limit_exceeded',
        message: 'Rate limit reached for qwen/qwen3.8-27b. Please try again in 1.5s.',
      },
    });

    expect(event).toMatchObject({ kind: 'error', code: 'quota_exceeded', retryAfterSeconds: 2 });
  });

  it('reporta el resto de los errores sin marcarlos como cuota', () => {
    const event = openaiProvider.readEvent({
      error: { code: 'invalid_request_error', message: 'Unsupported parameter' },
    });

    expect(event).toMatchObject({ kind: 'error', code: 'invalid_request_error' });
    expect(event).not.toMatchObject({ code: 'quota_exceeded' });
  });

  it('ignora los frames que no traen nada en vez de romper', () => {
    expect(openaiProvider.readEvent({ id: 'chatcmpl-1', object: 'chat.completion.chunk' })).toBeNull();
  });
});
