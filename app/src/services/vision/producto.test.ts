/**
 * Existe porque el selector de modelo de Inicio sólo tiene sentido si TODOS los proveedores reciben
 * el mismo prompt y el mismo schema: si el request de un proveedor se desviara, elegir otro modelo
 * cambiaría la pregunta y la comparación mediría prompts, no modelos — sin que nadie lo note.
 * También fija que el default declarado sea el que efectivamente se usa: `PRODUCTO_MODEL` resuelve
 * el id con un fallback al primero del registro, y ese fallback taparía en silencio un id que ya no
 * existe — la app leería con un modelo distinto del que dice la constante, y la medición que
 * justifica el default estaría describiendo a otro (ADR 0006, medición del 2026-09-02).
 */
import {
  ANTHROPIC_MESSAGES_URL,
  GEMINI_INTERACTIONS_URL,
  MODEL_PROFILES,
  PERFILES_RETIRADOS,
} from './config';
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
  it('acepta la forma pedida: tipo y marca separados, no un solo nombre', () => {
    expect(
      parseProductoLeido('{"tipo": "arroz", "marca": "Saman", "detalle": "Blue Patna 1 kg"}'),
    ).toEqual({ tipo: 'arroz', marca: 'Saman', detalle: 'Blue Patna 1 kg' });
  });

  it('acepta null en cualquier campo: un envase ilegible tiene que poder decirlo', () => {
    expect(parseProductoLeido('{"tipo": null, "marca": null, "detalle": null}')).toEqual({
      tipo: null,
      marca: null,
      detalle: null,
    });
  });

  it('tolera envoltura en bloque de código', () => {
    expect(parseProductoLeido('```json\n{"tipo": "yerba", "marca": "Canarias", "detalle": null}\n```')).toEqual({
      tipo: 'yerba',
      marca: 'Canarias',
      detalle: null,
    });
  });

  it('rechaza JSON truncado o de otra forma', () => {
    expect(parseProductoLeido('{"tipo": "arro')).toBeNull();
    expect(parseProductoLeido('{"producto": "la clave vieja, de antes de separar tipo y marca"}')).toBeNull();
    expect(parseProductoLeido('{"tipo": 42, "marca": null, "detalle": null}')).toBeNull();
    expect(parseProductoLeido('')).toBeNull();
  });
});

describe('buildProductoRequest', () => {
  const input = { apiKey: 'clave-de-prueba', imageBase64: 'aW1hZ2Vu', mediaType: 'image/jpeg' as const };

  /**
   * Gemini y Anthropic salieron del selector el 2026-09-02, pero sus proveedores siguen en el
   * binario: lo que estos dos casos verifican no es que el modelo esté ofrecido, es que el prompt y
   * el schema son los MISMOS para todos los dialectos. Si dejaran de serlo, comparar modelos
   * mediría prompts.
   */
  const retirado = (id: string) => PERFILES_RETIRADOS.find((p) => p.id === id)!;

  it('con un modelo Gemini arma el request de la Interactions API con el prompt y el schema de producto', () => {
    const request = buildProductoRequest({ ...input, model: retirado('gemini-3.5-flash-lite') });
    const body = request.body as {
      model: string;
      input: { type: string; text?: string }[];
      response_format: { schema: unknown };
    };

    expect(request.url).toBe(GEMINI_INTERACTIONS_URL);
    expect(body.model).toBe('gemini-3.5-flash-lite');
    expect(body.input.filter((b) => b.type === 'text').map((b) => b.text)).toEqual([
      PRODUCTO_SYSTEM_PROMPT,
      PRODUCTO_USER_PROMPT,
    ]);
    expect(body.response_format.schema).toBe(productoSchema);
  });

  it('con un modelo Anthropic arma el request de la Messages API con el MISMO prompt y schema', () => {
    const request = buildProductoRequest({ ...input, model: retirado('claude-haiku-4-5') });
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

  it('el default resuelto es el que declara DEFAULT_PRODUCTO_MODEL_ID, y está en el selector', () => {
    // `PRODUCTO_MODEL` resuelve el id contra el registro con un fallback al primero. Si el id
    // dejara de existir, el fallback lo taparía en silencio y la app leería con otro modelo del que
    // dice la constante — con la medición que justifica el default apuntando al equivocado.
    expect(PRODUCTO_MODEL.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
    expect(MODEL_PROFILES.some((p) => p.id === DEFAULT_PRODUCTO_MODEL_ID)).toBe(true);
  });

  it('el schema de producto cumple lo que exigen ambas APIs', () => {
    expect(productoSchema.required).toEqual(['tipo', 'marca', 'detalle']);
    expect(productoSchema.additionalProperties).toBe(false);
  });
});
