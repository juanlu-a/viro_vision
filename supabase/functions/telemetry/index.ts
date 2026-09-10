/**
 * App telemetry: receives batches of events and stores them in `public.events`.
 *
 * It exists to see remotely what happened when someone uses the device (2026-09-07): the app has no
 * database key, so it posts here and this function inserts with the **service role**. It weighs more
 * since 2026-09-08, when the technical information left the screens: this table is the only
 * diagnosis left today.
 *
 * ⚠️ **This file was recovered from the deployed v1** (`supabase functions download telemetria`,
 * 2026-09-09). The function had been written in the dashboard and was not versioned, which is
 * exactly why nobody could know its contract without downloading it. Here it is with the codebase's
 * types and style; **the logic is the same, line by line**.
 *
 * Deliberately without user auth (`verify_jwt = false`, same as the vision proxy, ADR 0008): the app
 * has no accounts and an anon key inside the bundle would not be a defence. The cost of abuse is
 * noise in a development table, bounded by the two caps below.
 *
 * The app-side mirror is `app/src/services/telemetry/types.ts`: if the contract changes here, it
 * changes there in the same PR.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** More than this per batch is trimmed and the tail is lost: that is why the app sends 100 at a time. */
const MAX_EVENTS_PER_BATCH = 100;

/**
 * The detail's cap. When exceeded, the **whole** detail is replaced by `{trimmed: true}`, not just
 * the excess: it is the signal that someone sent something that does not belong here (an image, a
 * long text).
 */
const MAX_DETAIL_BYTES = 8_000;

interface IncomingEvent {
  type?: unknown;
  at?: unknown;
  ms?: unknown;
  detail?: unknown;
}

interface IncomingBatch {
  phone?: unknown;
  session?: unknown;
  app?: unknown;
  events?: unknown;
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return reply(405, { error: 'POST' });

  let batch: IncomingBatch;
  try {
    batch = await request.json();
  } catch {
    return reply(400, { error: 'invalid JSON' });
  }

  if (!batch?.phone || !batch?.session || !Array.isArray(batch.events)) {
    return reply(400, { error: 'phone, session or events missing' });
  }

  // An event with no `type` or no `at` is dropped **silently**: the response is still 200 with
  // `stored: 0`. It is the contract's trap, and that is why the client always fills them in.
  const events = (batch.events as IncomingEvent[]).slice(0, MAX_EVENTS_PER_BATCH).flatMap((e) => {
    if (!e?.type || !e?.at) return [];
    let detail: unknown = e.detail ?? {};
    if (JSON.stringify(detail).length > MAX_DETAIL_BYTES) detail = { trimmed: true };
    return [
      {
        phone: String(batch.phone).slice(0, 64),
        session: String(batch.session).slice(0, 64),
        app: batch.app ? String(batch.app).slice(0, 64) : null,
        type: String(e.type).slice(0, 64),
        occurred_at: e.at,
        ms: typeof e.ms === 'number' && Number.isFinite(e.ms) ? Math.round(e.ms) : null,
        detail,
      },
    ];
  });

  if (events.length === 0) return reply(200, { stored: 0 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { error } = await supabase.from('events').insert(events);
  if (error) return reply(500, { error: error.message });

  return reply(200, { stored: events.length });
});
