/**
 * The contract with the `telemetry` function (ADR 0008, same family as the vision proxy).
 *
 * **A mirror of `supabase/functions/telemetry/index.ts`**, the way `features/device/gatt.ts` is a
 * mirror of the device's profile: if the contract changes over there, it changes here in the same PR.
 *
 * Two rules of the function that cannot be seen from here and bite silently:
 *   - an event **with no `type` or no `at` is dropped without an error**: the response says
 *     `{stored: 0}` with status 200, so a misplaced field is never noticed. That is why the type
 *     makes them mandatory and `record()` fills `at` in itself;
 *   - `detail` is serialized and if it goes past 8 KB it is replaced entirely by `{trimmed: true}` —
 *     ALL of the detail is lost, not just the excess. Never put an image or a long text in here.
 */

/**
 * The event types, deliberately closed.
 *
 * It is a table that later has to be queried: with free strings, a `reading.failed` and a
 * `reading_failed` live happily side by side and no query sees both. Adding a type is adding a line
 * here.
 */
export type EventType =
  // App lifecycle
  | 'app.start'
  | 'app.background'
  | 'app.foreground'
  | 'app.error'
  // BLE link (control plane, ADR 0003)
  | 'ble.scanning'
  | 'ble.connected'
  | 'ble.failed'
  | 'ble.lost'
  | 'ble.retry'
  | 'ble.disconnected'
  | 'ble.event'
  // WiFi network with the device (where the photo travels)
  | 'wifi.joining'
  | 'wifi.ready'
  | 'wifi.failed'
  // What the device reports about itself
  | 'device.status'
  | 'device.warning'
  | 'device.mode'
  | 'device.modeFailed'
  | 'device.readRequest'
  // Operating modes (ADR 0007)
  | 'mode.change'
  // One reading, end to end
  | 'reading.requested'
  | 'reading.start'
  | 'reading.ok'
  | 'reading.failed'
  | 'photo.ok'
  | 'photo.failed'
  | 'ocr.load'
  | 'cloud.wait'
  | 'audio.synthesis'
  | 'audio.send'
  | 'audio.session'
  | 'audio.spoken';

export interface TelemetryEvent {
  type: EventType;
  /** ISO 8601. Mandatory: without it the function drops the event and answers 200 all the same. */
  at: string;
  /** Duration of what the event measures, when it measures something. The function rounds it to an integer. */
  ms?: number;
  /** The event's context. Serialized it has to stay under 8 KB (see above). */
  detail?: Record<string, unknown>;
}

/** The body the function expects. `app` identifies the version, so builds are not compared blindly. */
export interface TelemetryBatch {
  phone: string;
  session: string;
  app: string;
  events: TelemetryEvent[];
}
