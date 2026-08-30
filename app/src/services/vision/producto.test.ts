/**
 * Existe porque el selector de modelo de Inicio sólo tiene sentido si TODOS los proveedores reciben
 * el mismo prompt y el mismo schema: si el request de un proveedor se desviara, elegir otro modelo
 * cambiaría la pregunta y la comparación mediría prompts, no modelos — sin que nadie lo note.
 * También fija el default (Flash, no Lite: en supermercado la complejidad manda, ADR 0006).
 */
import { ANTHROPIC_MESSAGES_URL, GEMINI_INTERACTIONS_URL, findModelProfile } from './config';
import {
  DEFAULT_PRODUCTO_MODEL_ID,
  PRODUCTO_MODEL,
  PRODUCTO_PROMPTS,
  buildProductoRequest,
  parseProductoLeido,
  productoSchema,
} from './producto';
import { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './providers/prompts';

describe('parseProductoLeido', () => {
  it('acepta la forma pedida', () => {
    expect(parseProductoLeido('{"producto": "Arroz Blue Patna", "detalle": "1 kg"}')).toEqual({
      producto: 'Arroz Blue Patna',
      detalle: '1 kg',
    });
  });

  it('acepta null en cualquier campo: un envase ilegible tiene que poder decirlo', () => {
    expect(parseProductoLeido('{"producto": null, "detalle": null}')).toEqual({ producto: null, detalle: null });
  });

  it('tolera envoltura en bloque de código', () => {
    expect(parseProductoLeido('```json\n{"producto": "Yerba", "detalle": null}\n```')).toEqual({
      producto: 'Yerba',
      detalle: null,
    });
  });

  it('rechaza JSON truncado o de otra forma', () => {
    expect(parseProductoLeido('{"producto": "Arro')).toBeNull();
    expect(parseProductoLeido('{"nombre": "no es esta clave"}')).toBeNull();
    expect(parseProductoLeido('{"producto": 42, "detalle": null}')).toBeNull();
    expect(parseProductoLeido('')).toBeNull();
  });
});

describe('buildProductoRequest', () => {
  const input = { apiKey: 'clave-de-prueba', imageBase64: 'aW1hZ2Vu', mediaType: 'image/jpeg' as const };

  it('con un modelo Gemini arma el request de la Interactions API con el prompt y el schema de producto', () => {
    const request = buildProductoRequest({ ...input, model: findModelProfile('gemini-3.6-flash') });
    const body = request.body as {
      model: string;
      input: { type: string; text?: string }[];
      response_format: { schema: unknown };
    };

    expect(request.url).toBe(GEMINI_INTERACTIONS_URL);
    expect(body.model).toBe('gemini-3.6-flash');
    expect(body.input.filter((b) => b.type === 'text').map((b) => b.text)).toEqual([
      PRODUCTO_SYSTEM_PROMPT,
      PRODUCTO_USER_PROMPT,
    ]);
    expect(body.response_format.schema).toBe(productoSchema);
  });

  it('con un modelo Anthropic arma el request de la Messages API con el MISMO prompt y schema', () => {
    const request = buildProductoRequest({ ...input, model: findModelProfile('claude-haiku-4-5') });
    const body = request.body as {
      model: string;
      system: string;
      output_config: { format: { schema: unknown } };
    };

    expect(request.url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.system).toBe(PRODUCTO_PROMPTS.system);
    expect(body.output_config.format.schema).toBe(productoSchema);
  });

  it('el default es Gemini Flash, no Lite: en supermercado la complejidad manda', () => {
    expect(PRODUCTO_MODEL.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
    expect(PRODUCTO_MODEL.provider).toBe('gemini');
    expect(PRODUCTO_MODEL.id).toContain('flash');
    expect(PRODUCTO_MODEL.id).not.toContain('lite');
  });

  it('el schema de producto cumple lo que exigen ambas APIs', () => {
    expect(productoSchema.required).toEqual(['producto', 'detalle']);
    expect(productoSchema.additionalProperties).toBe(false);
  });
});
