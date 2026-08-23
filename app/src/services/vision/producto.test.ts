/**
 * Existe porque el camino de supermercado tiene dos candidatos (nube y local, ADR 0006) que
 * DEBEN compartir prompt y forma de respuesta: si el request de la nube se desviara del schema o
 * del prompt compartido, la comparación que cierra la decisión mediría el prompt y no el modelo,
 * sin que nadie lo note. También fija que el parser tolere lo mismo que el de ómnibus.
 */
import { buildProductoRequest, parseProductoLeido, PRODUCTO_MODEL, productoSchema } from './producto';
import { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './providers/prompts';

describe('parseProductoLeido', () => {
  it('acepta la forma pedida', () => {
    expect(parseProductoLeido('{"producto": "Arroz Blue Patna", "detalle": "1 kg"}')).toEqual({
      producto: 'Arroz Blue Patna',
      detalle: '1 kg',
    });
  });

  it('acepta null en cualquier campo: un envase ilegible tiene que poder decirlo', () => {
    expect(parseProductoLeido('{"producto": null, "detalle": null}')).toEqual({
      producto: null,
      detalle: null,
    });
  });

  it('tolera envoltura en bloque de código, como el parser de ómnibus', () => {
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
  const request = buildProductoRequest({
    apiKey: 'clave-de-prueba',
    imageBase64: 'aW1hZ2Vu',
    mediaType: 'image/jpeg',
  });

  it('usa el prompt compartido de producto, no el de ómnibus', () => {
    const textos = (request.body.input as { type: string; text?: string }[])
      .filter((block) => block.type === 'text')
      .map((block) => block.text);
    expect(textos).toEqual([PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT]);
  });

  it('pide la respuesta contra el schema de producto', () => {
    expect((request.body.response_format as { schema: unknown }).schema).toBe(productoSchema);
  });

  it('va a un modelo Gemini Flash (no Lite): en supermercado la complejidad manda', () => {
    expect(PRODUCTO_MODEL.provider).toBe('gemini');
    expect(request.body.model).toBe(PRODUCTO_MODEL.id);
    expect(PRODUCTO_MODEL.id).toContain('flash');
    expect(PRODUCTO_MODEL.id).not.toContain('lite');
  });
});
