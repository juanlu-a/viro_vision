/**
 * Vision proxy: the app asks for a reading, this function adds the key (ADR 0008).
 *
 * It is a **deliberately dumb proxy**. It does not interpret the answer, does not build the request
 * and does not know the prompts: it receives the body the client's provider already built, adds the
 * authentication header from the secrets and returns the upstream body untouched. That way the
 * provider logic is NOT duplicated on the server side —there are no two copies to drift apart— and
 * adding a model remains a change in the app, not a deployment here.
 *
 * What does live here, because it cannot live in the client:
 *   - the keys;
 *   - the host allowlist, which is what keeps this from being an SSRF that hands the key to the
 *     first one who asks;
 *   - a per-IP brake.
 *
 * Deployment and secrets: `docs/supabase.md`.
 *
 * ⚠️ It is NOT authenticated (`verify_jwt = false`): the app has no login (ADR 0002) and the anon key
 * would travel in the bundle anyway, so requiring it would be an indirection, not a defence. The
 * endpoint is abusable and that is knowingly accepted in ADR 0008: what the proxy buys is not
 * making it unabusable, it is being able to rotate or cut the key in seconds without shipping a
 * version of the app. The real defences are the brake below and the SPENDING CAP in each provider's
 * console.
 */

/**
 * Which providers can be reached, and with which key.
 *
 * The client says **which provider** it is going to and the URL its module built, but it is only
 * accepted if that URL's host is the one this table names. It is the central guard: a proxy that
 * forwards to whatever URL it is given hands the key to anyone who asks for a redirect to their own
 * server.
 *
 * It validates by **host** and not by exact URL on purpose: the path is chosen by the client's
 * module (which knows whether the provider uses `/v1/messages` or `/v1/chat/completions`), so this
 * file does not have to find out every time the app adds a model.
 */
const PROVIDERS: Record<
  string,
  { host: string; secret: string; headers: (key: string) => Record<string, string> }
> = {
  gemini: {
    host: 'generativelanguage.googleapis.com',
    secret: 'GEMINI_API_KEY',
    headers: (key) => ({ 'x-goog-api-key': key }),
  },
  openai: {
    host: 'api.openai.com',
    secret: 'OPENAI_API_KEY',
    headers: (key) => ({ authorization: `Bearer ${key}` }),
  },
  anthropic: {
    host: 'api.anthropic.com',
    secret: 'ANTHROPIC_API_KEY',
    // The version is set by the server and not by the client: it is part of which API we talk to,
    // not of what we ask the model.
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  },
  groq: {
    host: 'api.groq.com',
    secret: 'GROQ_API_KEY',
    headers: (key) => ({ authorization: `Bearer ${key}` }),
  },
};

/** Window and cap of the per-IP brake. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

/**
 * A per-IP brake, in the isolate's memory.
 *
 * It is **a speed bump, not a wall**: Supabase can spin up several isolates and each one counts its
 * own, so a determined attacker gets through. It is there for what actually happens in practice —a
 * loop in the app or a repeated curl— and costs nothing. The real defence against sustained abuse is
 * the spending cap at each provider, plus being able to switch this function off.
 */
const hits = new Map<string, number[]>();

function overTheBrake(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: { message: 'POST only.' } });

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (overTheBrake(ip, Date.now())) {
    // The same code providers use for quota: the client already knows how to tell it apart and wait
    // instead of aborting the series.
    return json(429, {
      error: { code: 'rate_limit_exceeded', message: 'Too many readings. Try again in 60s.' },
    });
  }

  let envelope: { provider?: unknown; url?: unknown; body?: unknown };
  try {
    envelope = await request.json();
  } catch {
    return json(400, { error: { message: 'Body is not JSON.' } });
  }

  const provider = typeof envelope.provider === 'string' ? PROVIDERS[envelope.provider] : undefined;
  if (!provider) {
    return json(400, { error: { message: `Unknown provider: ${String(envelope.provider)}` } });
  }

  if (typeof envelope.url !== 'string' || typeof envelope.body !== 'object' || envelope.body === null) {
    return json(400, { error: { message: '`url` or `body` missing.' } });
  }

  // THE guard. Without it, `url` is a hole through which the key leaves towards wherever the
  // attacker wants: asking for a forward to their own host is enough.
  let target: URL;
  try {
    target = new URL(envelope.url);
  } catch {
    return json(400, { error: { message: 'Invalid URL.' } });
  }
  if (target.protocol !== 'https:' || target.host !== provider.host) {
    return json(400, {
      error: { message: `The target does not match the provider: ${target.host}` },
    });
  }

  const key = Deno.env.get(provider.secret) ?? '';
  if (key === '') {
    // 503 and not 500: it is not broken, it is unconfigured. The message names the missing secret so
    // the fix is obvious without opening the logs.
    return json(503, {
      error: { message: `The proxy does not have ${provider.secret} configured (supabase secrets set).` },
    });
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...provider.headers(key) },
      body: JSON.stringify(envelope.body),
    });
  } catch (err) {
    return json(502, {
      error: { message: `Could not reach the provider: ${(err as Error).message}` },
    });
  }

  // The pass-through: the provider's body is returned UNTOUCHED, SSE stream included. Reading it
  // here to forward it would force duplicating each provider's event parsing and would kill the
  // streaming — the client would see the whole answer at once instead of as it arrives.
  return new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'text/event-stream',
      'cache-control': 'no-cache',
    },
  });
});
