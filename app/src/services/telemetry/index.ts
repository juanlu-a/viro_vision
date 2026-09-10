/**
 * App telemetry: what happened, so it can be looked at when something fails (`events` table in
 * Supabase).
 *
 * BOUNDARY RULE (ADR 0001): this goes out to the internet. **Never from the recognition path nor
 * from the announcement path** — the linter enforces it for `features/recognition/` and
 * `features/audio/`. Recording an event is synchronous and waits for nothing, so it cannot delay a
 * reading; the full reasoning is in `recorder.ts`.
 *
 * Pure barrel: the single import surface (`@/services/telemetry`).
 */
export { record, flush, startTelemetry, isTelemetryConfigured } from './recorder';
export type { TelemetryEvent, TelemetryBatch, EventType } from './types';
