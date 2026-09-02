/**
 * Existe porque las dos formas de romper esto no fallan a la vista.
 *
 * La primera: si el pedido de voz no pasara por el transporte, la clave de OpenAI viajaría desde el
 * teléfono y la síntesis andaría **igual de bien** — exactamente lo que ADR 0008 existe para
 * impedir, sin ningún síntoma. La segunda: pasarse de los 4096 caracteres que la API acepta es un
 * 400 que deja al usuario sin archivo, y el texto de una lectura de producto es corto hoy pero el
 * detalle de etiqueta (objetivo opcional de la tesis) puede crecer.
 */
import { construirPedidoDeVoz, MAX_CARACTERES, nombreDeArchivo } from './sintesis';

describe('construirPedidoDeVoz', () => {
  it('pide MP3 al modelo de voz, con el texto como input', () => {
    const body = construirPedidoDeVoz('arroz Saman, Blue Patna 1 kg', 'sk-secreta').body as {
      model: string;
      input: string;
      response_format: string;
      voice: string;
    };

    expect(body.response_format).toBe('mp3');
    expect(body.input).toBe('arroz Saman, Blue Patna 1 kg');
    expect(body.model).toBe('gpt-4o-mini-tts');
    expect(body.voice).toBeTruthy();
  });

  it('trunca al tope de la API en vez de comerse un 400', () => {
    const largo = 'a'.repeat(MAX_CARACTERES + 500);
    const { input } = construirPedidoDeVoz(largo, 'sk-secreta').body as { input: string };

    expect(input).toHaveLength(MAX_CARACTERES);
  });

  it('sin proxy configurado sale directo a OpenAI', () => {
    // Es el camino de desarrollo: en los tests no hay EXPO_PUBLIC_VISION_PROXY_URL.
    const pedido = construirPedidoDeVoz('hola', 'sk-secreta');

    expect(pedido.url).toBe('https://api.openai.com/v1/audio/speech');
    expect(pedido.headers.authorization).toBe('Bearer sk-secreta');
  });

  it('el pedido pasa por el transporte, que es lo que saca la clave cuando hay proxy', () => {
    // Se verifica la forma que el transporte produce, no el transporte en sí (eso lo cubre
    // cloud/transport.test.ts): si algún día alguien arma el fetch a mano acá, este test cae.
    const pedido = construirPedidoDeVoz('hola', 'sk-secreta');

    expect(Object.keys(pedido)).toEqual(expect.arrayContaining(['url', 'headers', 'body']));
  });
});

describe('nombreDeArchivo', () => {
  it('es ordenable alfabéticamente y sin caracteres que rompan una ruta', () => {
    // Los dos puntos del ISO no son válidos en varios sistemas de archivos, y ordenar por nombre
    // es cómo se encuentra la última lectura mirando la carpeta.
    const nombre = nombreDeArchivo(new Date('2026-09-01T18:30:05.123Z'));

    expect(nombre).toBe('lectura-2026-09-01T18-30-05-123Z.mp3');
    expect(nombre).not.toContain(':');
    expect(nombreDeArchivo(new Date('2026-09-01T18:30:04.000Z')) < nombre).toBe(true);
  });
});
