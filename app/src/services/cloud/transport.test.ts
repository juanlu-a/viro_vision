/**
 * Exists because the whole point of the proxy (ADR 0008) is that the key never leaves the phone, and
 * the way to break it does not fail visibly: if the provider's headers were forwarded along with the
 * body, the reading would keep working **just as well** while the key travels exactly as before. A
 * test is the only way for that not to go unnoticed.
 *
 * It also pins the envelope the Edge Function expects (`supabase/functions/vision/index.ts`): they
 * are two files that share no code —one runs on Hermes and the other on Deno— and if the contract
 * drifts, the proxy answers 400 and nobody knows why.
 */
import { resolveTransport } from './transport';
import type { CloudRequest } from './types';

const direct: CloudRequest = {
  url: 'https://api.openai.com/v1/chat/completions',
  headers: { 'content-type': 'application/json', authorization: 'Bearer sk-secret' },
  body: { model: 'gpt-5.6-luna', stream: true },
};

const PROXY = 'https://project.supabase.co/functions/v1/vision';

describe('resolveTransport', () => {
  it('leaves the request untouched when no proxy is configured', () => {
    // It is the development path, against a local .env: it has to keep working as is.
    expect(resolveTransport(direct, 'openai', '')).toBe(direct);
  });

  it('with a proxy, the key does NOT travel', () => {
    const throughProxy = resolveTransport(direct, 'openai', PROXY);

    expect(JSON.stringify(throughProxy)).not.toContain('sk-secret');
    expect(throughProxy.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('with a proxy, the destination is the proxy and not the provider', () => {
    expect(resolveTransport(direct, 'openai', PROXY).url).toBe(PROXY);
  });

  it('sends the provider, the original URL and the body untouched', () => {
    // The URL travels so the path keeps being chosen by the provider module; the server validates it
    // against the host allowlist. The body is passed as is: the proxy is dumb and knows neither the
    // prompts nor the schema.
    expect(resolveTransport(direct, 'openai', PROXY).body).toEqual({
      provider: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      body: direct.body,
    });
  });

  it('the envelope\'s provider is the one passed in, not one guessed from the URL', () => {
    // The server cross-checks the two: if the envelope said one provider and the URL belonged to
    // another host, it rejects. Guessing it here would mean that cross-check could never fail and
    // the guard would be useless.
    const anthropic: CloudRequest = {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': 'sk-ant-secret', 'anthropic-version': '2023-06-01' },
      body: { model: 'claude-haiku-4-5' },
    };
    const throughProxy = resolveTransport(anthropic, 'anthropic', PROXY);

    expect(throughProxy.body).toMatchObject({ provider: 'anthropic' });
    // `anthropic-version` is restored by the server: it is part of which API we talk to, not of what
    // we ask the model, and sending it from the client would be one more thing that can drift.
    expect(JSON.stringify(throughProxy)).not.toContain('anthropic-version');
    expect(JSON.stringify(throughProxy)).not.toContain('sk-ant-secret');
  });
});
