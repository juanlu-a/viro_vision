/**
 * Existe porque las dos formas de romper esto no fallan a la vista.
 *
 * La primera: si el pedido de voz no pasara por el transporte, la clave de OpenAI viajaría desde el
 * teléfono y la síntesis andaría **igual de bien** — exactamente lo que ADR 0008 existe para
 * impedir, sin ningún síntoma. La segunda: pasarse de los 4096 caracteres que la API acepta es un
 * 400 que deja al usuario sin archivo, y el texto de una lectura de producto es corto hoy pero el
 * detalle de etiqueta (objetivo opcional de la tesis) puede crecer.
 *
 * **Cada caso pasa el proxy explícitamente y ninguno lee el entorno.** La versión anterior asumía
 * que no había proxy configurado: pasaba en local, donde jest no carga `.env`, y fallaba en el job
 * de publicación, donde la variable sí está. Un test que cambia de resultado según dónde corre no
 * está verificando el código.
 */
import { construirPedidoDeVoz, MAX_CARACTERES, nombreDeArchivo } from './sintesis';

/** Sin proxy: el camino directo, el de desarrollo local. */
const DIRECTO = '';
const PROXY = 'https://proyecto.supabase.co/functions/v1/vision';

describe('construirPedidoDeVoz', () => {
  it('pide MP3 al modelo de voz, con el texto como input', () => {
    const body = construirPedidoDeVoz('arroz Saman, Blue Patna 1 kg', 'sk-secreta', DIRECTO).body as {
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
    const { input } = construirPedidoDeVoz(largo, 'sk-secreta', DIRECTO).body as { input: string };

    expect(input).toHaveLength(MAX_CARACTERES);
  });

  it('sin proxy sale directo a OpenAI, con la clave en el header', () => {
    const pedido = construirPedidoDeVoz('hola', 'sk-secreta', DIRECTO);

    expect(pedido.url).toBe('https://api.openai.com/v1/audio/speech');
    expect(pedido.headers.authorization).toBe('Bearer sk-secreta');
  });

  it('con proxy, la clave NO viaja', () => {
    // Es el punto entero de ADR 0008, y la forma de romperlo no falla a la vista: si el pedido
    // dejara de pasar por el transporte, la síntesis andaría igual de bien mientras la clave sale
    // del teléfono. La voz sale por el mismo proxy que la lectura de producto.
    const pedido = construirPedidoDeVoz('hola', 'sk-secreta', PROXY);

    expect(pedido.url).toBe(PROXY);
    expect(JSON.stringify(pedido)).not.toContain('sk-secreta');
    expect(pedido.body).toMatchObject({
      provider: 'openai',
      url: 'https://api.openai.com/v1/audio/speech',
    });
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
