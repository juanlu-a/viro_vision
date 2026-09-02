/**
 * Existe por un defecto real encontrado midiendo contra la API (2026-09-02): la cuota de Groq llega
 * como **HTTP 429 con cuerpo JSON**, no como evento SSE, y por ese camino el usuario escuchaba "La
 * nube no respondió" en vez de "Cuota agotada, reintentá en N s" — con el dato de cuánto esperar
 * llegando y nadie leyéndolo. Los payloads de abajo son los reales, no inventados a partir de los
 * docs: la redacción del tiempo de reintento cambia entre proveedores y es lo que se está parseando.
 */
import { VisionHttpError, VisionQuotaError } from './errors';
import { ESPERA_POR_DEFECTO_S, interpretarErrorHttp } from './httpError';

/** Capturado de la API real el 2026-09-02, agotando el límite de tokens por minuto de Groq. */
const CUOTA_GROQ = JSON.stringify({
  error: {
    message:
      'Rate limit reached for model `qwen/qwen3.8-27b` in organization `org_01m1` service tier ' +
      '`on_demand` on tokens per minute (TPM): Limit 8000, Used 5670, Requested 2486. ' +
      'Please try again in 1.17s. Need more tokens? Upgrade to Dev Tier today.',
    type: 'tokens',
    code: 'rate_limit_exceeded',
  },
});

describe('interpretarErrorHttp', () => {
  it('convierte el 429 de Groq en un error de cuota, con los segundos del mensaje', () => {
    const err = interpretarErrorHttp(429, CUOTA_GROQ);

    expect(err).toBeInstanceOf(VisionQuotaError);
    expect((err as VisionQuotaError).retryAfterSeconds).toBe(2); // 1,17 s redondeado hacia arriba
  });

  it('entiende la redacción de Gemini, que dice "retry" y no "try again"', () => {
    const err = interpretarErrorHttp(
      429,
      JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Please retry in 29.22s.' } }),
    );

    expect(err).toBeInstanceOf(VisionQuotaError);
    expect((err as VisionQuotaError).retryAfterSeconds).toBe(30);
  });

  it('nunca devuelve 0 segundos cuando el proveedor contesta en milisegundos', () => {
    // OpenAI puede decir "in 20ms". Redondeado a 0 s sería reintentar de inmediato contra un
    // límite todavía activo, y el reintento vuelve a fallar.
    const err = interpretarErrorHttp(
      429,
      JSON.stringify({ error: { message: 'Rate limit reached. Please try again in 20ms.', code: 'rate_limit_exceeded' } }),
    );

    expect((err as VisionQuotaError).retryAfterSeconds).toBe(1);
  });

  it('el header Retry-After le gana al texto del mensaje', () => {
    // Es un número y no una frase: no se rompe si el proveedor reescribe el mensaje.
    const err = interpretarErrorHttp(429, CUOTA_GROQ, '7');

    expect((err as VisionQuotaError).retryAfterSeconds).toBe(7);
  });

  it('si el 429 no dice cuánto esperar, usa la espera por defecto en vez de reintentar ya', () => {
    const err = interpretarErrorHttp(429, JSON.stringify({ error: { message: 'Too many requests' } }));

    expect((err as VisionQuotaError).retryAfterSeconds).toBe(ESPERA_POR_DEFECTO_S);
  });

  it('reconoce la cuota por el código aunque el status no sea 429', () => {
    const err = interpretarErrorHttp(
      403,
      JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }),
    );

    expect(err).toBeInstanceOf(VisionQuotaError);
  });

  it('cualquier otro error sigue siendo VisionHttpError, con el body intacto', () => {
    // El body entero se conserva porque es lo único que dice qué parámetro rechazó la API.
    const body = JSON.stringify({ error: { message: 'Unsupported parameter: max_tokens' } });
    const err = interpretarErrorHttp(400, body);

    expect(err).toBeInstanceOf(VisionHttpError);
    expect((err as VisionHttpError).status).toBe(400);
    expect((err as VisionHttpError).body).toBe(body);
  });

  it('no se rompe con un cuerpo que no es JSON (un HTML de proxy, por ejemplo)', () => {
    const err = interpretarErrorHttp(502, '<html>Bad Gateway</html>');

    expect(err).toBeInstanceOf(VisionHttpError);
  });
});
