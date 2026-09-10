/**
 * The queue of events pending upload. A PURE module —no network, no React, no clock— so the
 * drop policy can be tested, which is the part that decides what gets lost when something goes wrong.
 *
 * And something will go wrong: telemetry is uploaded from a phone joined to the device's WiFi, a
 * network **with no internet** (ADR 0003). Which means that during a real usage session sending
 * fails repeatedly and the queue grows. That is why there is a cap and an explicit rule about what
 * gets thrown away.
 *
 * **The oldest goes.** When diagnosis matters —someone reports that it did not read the sign— what
 * has to be looked at are the last few seconds, not the app's startup. Keeping the old and throwing
 * the new would leave a hole exactly where the failure is.
 */
import type { TelemetryEvent } from './types';

/** The function's cap: a larger batch is trimmed server-side and the tail is lost. */
export const MAX_PER_BATCH = 100;

/**
 * How many events are kept when they cannot be uploaded. 500 is a few minutes of heavy use and a few
 * hundred KB in memory; more than that is hoarding for nobody, because the old ones are never
 * queried.
 */
export const MAX_QUEUED = 500;

export class EventQueue {
  private events: TelemetryEvent[] = [];
  private dropped = 0;

  constructor(private readonly max: number = MAX_QUEUED) {}

  get length(): number {
    return this.events.length;
  }

  /**
   * How many events were thrown away for lack of room since the last batch sent. It travels in the
   * next batch: a silent hole in telemetry is worse than having none, because it leads to concluding
   * that something "did not happen" when in fact it could not be recorded.
   */
  get droppedCount(): number {
    return this.dropped;
  }

  enqueue(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > this.max) {
      this.dropped += this.events.length - this.max;
      this.events = this.events.slice(-this.max);
    }
  }

  /** Takes up to `MAX_PER_BATCH` events, oldest first: the table is read in order. */
  takeBatch(max: number = MAX_PER_BATCH): TelemetryEvent[] {
    return this.events.splice(0, max);
  }

  /**
   * Puts a batch that could not be uploaded back in the queue, **at the front**, so the order is not
   * disturbed.
   *
   * If new events arrived meanwhile and no longer all fit, the dropping is done by `enqueue` as
   * always: the oldest is lost, which here is precisely the returned batch. That is deliberate — a
   * batch that already failed competes on equal terms with what is happening now, and what is
   * happening now is worth more.
   */
  returnBatch(batch: TelemetryEvent[]): void {
    this.events = [...batch, ...this.events];
    if (this.events.length > this.max) {
      this.dropped += this.events.length - this.max;
      this.events = this.events.slice(-this.max);
    }
  }

  /** Called when a batch uploaded fine: the counter travelled with it and does not need repeating. */
  clearDropped(): void {
    this.dropped = 0;
  }

  /** Gives a batch up for lost without re-queuing it, adding it to the counter that travels later. */
  drop(count: number): void {
    this.dropped += count;
  }
}
