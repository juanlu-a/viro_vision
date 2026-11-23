/**
 * What the three public functions (`vision`, `telemetry`, `evidence`) share: the per-IP brake, the
 * client address it keys on, and a body reader that enforces the size cap while reading. They used to
 * be copied into each function, with two different sweep implementations, and `telemetry` and
 * `evidence` read the body with `request.text()`, which buffers whatever a chunked request sends.
 */

/**
 * A per-IP brake, in the isolate's memory.
 *
 * It is **a speed bump, not a wall**: Supabase can spin up several isolates and each one counts its
 * own, so a determined attacker gets through. It is there for what actually happens in practice —a
 * loop in the app or a repeated curl— and costs nothing. The real defence against sustained abuse is
 * the spending cap at each provider, plus being able to switch this function off.
 */
export function createBrake(windowMs: number, maxPerWindow: number): (ip: string, now: number) => boolean {
  const hits = new Map<string, number[]>();
  let sweptAt = 0;

  /**
   * Drops the IPs whose window is empty, at most once per window (2026-10-06). Without it every
   * address ever seen kept its entry for the isolate's lifetime — and with the IP taken from a
   * header the client writes, minting a new "address" per request grew the map without bound.
   */
  function sweep(now: number): void {
    if (now - sweptAt < windowMs) return;
    sweptAt = now;
    for (const [ip, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(ip);
    }
  }

  return (ip: string, now: number): boolean => {
    sweep(now);
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    const over = recent.length >= maxPerWindow;
    if (!over) recent.push(now);
    hits.set(ip, recent);
    return over;
  };
}

/**
 * Who is asking, as far as the brake can tell.
 *
 * ⚠️ UNVERIFIED (2026-10-06): which of these headers the Supabase edge runtime actually forwards,
 * and which of them it overwrites rather than passes through from the client, has not been checked
 * against a deployed function. Check it after deploying (log the three headers from a phone and
 * from a curl that sets them by hand) and drop whatever turns out to be forgeable.
 *
 * The order is what is safest without that check:
 *   - `cf-connecting-ip`: if Supabase's edge sits behind Cloudflare, Cloudflare sets it itself and
 *     overwrites whatever the client sent.
 *   - `x-real-ip`: set by the usual reverse proxies (nginx, Kong) to the address they saw.
 *   - the FIRST entry of `x-forwarded-for`: all this used until 2026-10-06, and whatever the client
 *     wrote there. Last resort only, so no ordering here is worse than before.
 * Not the LAST `x-forwarded-for` entry: that is the nearest proxy's own address, the same for every
 * phone, and keying on it would turn a per-phone brake into one shared by all of them.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * The body as text, or null past `max` bytes. Counted while reading, because `content-length` is
 * only what the client declares: a chunked body without it went straight to `request.json()`, which
 * buffers whatever arrives.
 */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}


/** True for a parsed JSON body that is an object (not `null`, an array or a primitive). */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
