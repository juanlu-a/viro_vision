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
 * exactly why nobody could know its contract without downloading it. It was ported with the logic
 * unchanged; since 2026-10-06 it validates each event on its own (see `toRow`), so one malformed
 * event no longer fails the batch. The response gained `dropped`; `stored` is unchanged.
 *
 * Deliberately without user auth (`verify_jwt = false`, same as the vision proxy, ADR 0008): the app
 * has no accounts and an anon key inside the bundle would not be a defence. The cost of abuse is
 * noise in a development table, bounded by the caps below.
 *
 * The app-side mirror is `app/src/services/telemetry/types.ts`: if the contract changes here, it
 * changes there in the same PR.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** More than this per batch is trimmed and the tail is lost: that is why the app sends 100 at a time. */
const MAX_EVENTS_PER_BATCH = 100;

/**
 * The detail's cap, in UTF-8 bytes of its JSON. When exceeded, the **whole** detail is replaced by
 * `{trimmed: true}`, not just the excess: it is the signal that someone sent something that does not
 * belong here (an image, a long text).
 *
 * 6000 and not the 8192 of the column's check (`events_detail_small`, `pg_column_size`): that check
 * measures jsonb's binary form, which for many small values is LARGER than the text, and until
 * 2026-10-06 this measured the text in UTF-16 code units (`.length`), so a detail in Spanish or with
 * emoji passed here and failed the check — failing the whole batch with it.
 */
const MAX_DETAIL_BYTES = 6_000;

/** A batch is at most 100 small events; anything this large is not the app. */
const MAX_BODY_BYTES = 1_000_000;

/** `ms` goes into an `integer` column: one value outside int4 failed the whole batch. */
const INT4_MIN = -2_147_483_648;
const INT4_MAX = 2_147_483_647;

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

interface Row {
  phone: string;
  session: string;
  app: string | null;
  type: string;
  occurred_at: string;
  ms: number | null;
  detail: unknown;
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const encoder = new TextEncoder();

/**
 * The detail as Postgres will accept it, or `{trimmed: true}`.
 *
 * NUL is stripped from every string because jsonb rejects `\u0000` ("unsupported Unicode escape
 * sequence") — and a rejected row used to be a rejected batch. Stripped through the replacer and
 * not from the serialized text: a literal backslash followed by `u0000` in a string serializes as
 * `\\u0000`, and a textual replace would leave a dangling backslash, i.e. invalid JSON.
 */
function cleanDetail(raw: unknown): unknown {
  let serialized: string;
  try {
    serialized = JSON.stringify(raw ?? {}, (_key, value) =>
      typeof value === 'string' ? value.replaceAll('\u0000', '') : value
    );
  } catch {
    return { trimmed: true };
  }
  if (serialized === undefined || encoder.encode(serialized).length > MAX_DETAIL_BYTES) {
    return { trimmed: true };
  }
  return JSON.parse(serialized);
}

/**
 * One incoming event as a row, or `null` when it cannot be stored.
 *
 * An event with no `type` or no `at` is dropped **silently**: the response is still 200 and it only
 * shows in `dropped`. It is the contract's trap, and that is why the client always fills them in.
 * Since 2026-10-06 an `at` that does not parse as a date is dropped the same way: before, it reached
 * the insert, failed the cast to timestamptz and took the other 99 events of the batch with it.
 */
function toRow(e: IncomingEvent, batch: { phone: string; session: string; app: string | null }): Row | null {
  if (!e?.type || typeof e.at !== 'string') return null;
  const at = Date.parse(e.at);
  if (!Number.isFinite(at)) return null;
  return {
    ...batch,
    type: String(e.type).slice(0, 64),
    occurred_at: new Date(at).toISOString(),
    ms:
      typeof e.ms === 'number' && Number.isFinite(e.ms)
        ? Math.min(INT4_MAX, Math.max(INT4_MIN, Math.round(e.ms)))
        : null,
    detail: cleanDetail(e.detail),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return reply(405, { error: 'POST' });

  // Checked before reading, when the client says; and after, for a body that did not say (chunked).
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return reply(413, { error: 'batch too large' });

  let batch: IncomingBatch;
  try {
    const text = await request.text();
    if (encoder.encode(text).length > MAX_BODY_BYTES) return reply(413, { error: 'batch too large' });
    batch = JSON.parse(text);
  } catch {
    return reply(400, { error: 'invalid JSON' });
  }

  if (
    typeof batch?.phone !== 'string' ||
    batch.phone === '' ||
    typeof batch?.session !== 'string' ||
    batch.session === '' ||
    !Array.isArray(batch.events)
  ) {
    return reply(400, { error: 'phone, session or events missing' });
  }

  const common = {
    phone: batch.phone.slice(0, 64),
    session: batch.session.slice(0, 64),
    app: batch.app ? String(batch.app).slice(0, 64) : null,
  };
  // `type` is a free string here (only its length is checked, `events_type_short`): a new event type
  // in the app —`device.log`, say— needs no change on this side.
  const incoming = (batch.events as IncomingEvent[]).slice(0, MAX_EVENTS_PER_BATCH);
  const events = incoming.flatMap((e) => {
    const row = toRow(e, common);
    return row ? [row] : [];
  });
  let dropped = incoming.length - events.length;

  if (events.length === 0) return reply(200, { stored: 0, dropped });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { error } = await supabase.from('events').insert(events);
  if (!error) return reply(200, { stored: events.length, dropped });

  // One row the database refuses fails the whole insert, and a 500 makes the app drop the batch:
  // until 2026-10-06 one bad event cost the other 99, which are exactly the session's diagnosis.
  // Row by row only on this path, so the cost is paid only when a batch is already broken.
  console.error('telemetry: batch insert failed, retrying row by row:', error.message);
  let stored = 0;
  for (const row of events) {
    const { error: rowError } = await supabase.from('events').insert(row);
    if (rowError) {
      dropped += 1;
      console.error('telemetry: row rejected:', rowError.message, row.type);
    } else {
      stored += 1;
    }
  }
  // The database's message stays in the server's log: it names tables, columns and constraints, and
  // this endpoint answers anyone.
  if (stored === 0) return reply(500, { error: 'could not store the events' });
  return reply(200, { stored, dropped });
});
