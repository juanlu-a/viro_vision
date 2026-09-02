/**
 * Existe porque el punto entero del proxy (ADR 0008) es que la clave no salga del teléfono, y la
 * forma de romperlo no falla a la vista: si las cabeceras del proveedor se reenviaran junto al
 * cuerpo, la lectura seguiría funcionando **igual de bien** mientras la clave viaja igual que
 * antes. Un test es la única forma de que eso no pase inadvertido.
 *
 * También fija el sobre que la Edge Function espera (`supabase/functions/vision/index.ts`): son dos
 * archivos que no comparten código —uno corre en Hermes y el otro en Deno— y si el contrato se
 * desincroniza, el proxy responde 400 y nadie sabe por qué.
 */
import { resolverTransporte } from './transport';
import type { ProviderRequest } from './types';

const directo: ProviderRequest = {
  url: 'https://api.openai.com/v1/chat/completions',
  headers: { 'content-type': 'application/json', authorization: 'Bearer sk-secreta' },
  body: { model: 'gpt-5.6-luna', stream: true },
};

const PROXY = 'https://proyecto.supabase.co/functions/v1/vision';

describe('resolverTransporte', () => {
  it('sin proxy configurado deja el request intacto', () => {
    // Es el camino de desarrollo, contra un .env local: tiene que seguir funcionando tal cual.
    expect(resolverTransporte(directo, 'openai', '')).toBe(directo);
  });

  it('con proxy, la clave NO viaja', () => {
    const porProxy = resolverTransporte(directo, 'openai', PROXY);

    expect(JSON.stringify(porProxy)).not.toContain('sk-secreta');
    expect(porProxy.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('con proxy, el destino es el proxy y no el proveedor', () => {
    expect(resolverTransporte(directo, 'openai', PROXY).url).toBe(PROXY);
  });

  it('manda el proveedor, la URL original y el cuerpo sin tocar', () => {
    // La URL viaja para que el path lo siga eligiendo el módulo del proveedor; el servidor la
    // valida contra la allowlist de hosts. El cuerpo se pasa tal cual: el proxy es tonto y no
    // conoce los prompts ni el schema.
    expect(resolverTransporte(directo, 'openai', PROXY).body).toEqual({
      provider: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      body: directo.body,
    });
  });

  it('el proveedor del sobre es el que se le pasa, no el que se adivine de la URL', () => {
    // El servidor cruza los dos: si el sobre dijera un proveedor y la URL fuera de otro host,
    // rechaza. Adivinarlo acá haría que ese cruce nunca pudiera fallar y la guarda sería inútil.
    const anthropic: ProviderRequest = {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': 'sk-ant-secreta', 'anthropic-version': '2023-06-01' },
      body: { model: 'claude-haiku-4-5' },
    };
    const porProxy = resolverTransporte(anthropic, 'anthropic', PROXY);

    expect(porProxy.body).toMatchObject({ provider: 'anthropic' });
    // `anthropic-version` la repone el servidor: es parte de con qué API hablamos, no de qué le
    // preguntamos al modelo, y mandarla desde el cliente sería otra cosa que puede desincronizarse.
    expect(JSON.stringify(porProxy)).not.toContain('anthropic-version');
    expect(JSON.stringify(porProxy)).not.toContain('sk-ant-secreta');
  });
});
