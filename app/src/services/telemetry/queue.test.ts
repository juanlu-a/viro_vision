/**
 * Exists because this queue decides **which diagnosis gets lost** when sending fails, and sending is
 * going to fail often: while the phone is joined to the device's AP there is WiFi but no internet
 * (ADR 0003). If dropping threw away the new instead of the old, the table would always hold the
 * app's startup and never the moment of failure — which is the only thing that will ever be queried.
 * And if drops were not counted, a hole would read as "that did not happen".
 */
import { EventQueue } from './queue';
import type { EventType, TelemetryEvent } from './types';

function event(n: number, type: EventType = 'reading.ok'): TelemetryEvent {
  return { type, at: new Date(n).toISOString(), detail: { n } };
}

const numbers = (batch: TelemetryEvent[]) => batch.map((e) => (e.detail as { n: number }).n);

describe('EventQueue', () => {
  it('hands out the oldest events first: the table is read in order', () => {
    const queue = new EventQueue();
    for (const n of [1, 2, 3]) queue.enqueue(event(n));
    expect(numbers(queue.takeBatch())).toEqual([1, 2, 3]);
    expect(queue.length).toBe(0);
  });

  it('past the cap it drops the OLD and keeps the new', () => {
    const queue = new EventQueue(3);
    for (const n of [1, 2, 3, 4, 5]) queue.enqueue(event(n));
    expect(numbers(queue.takeBatch())).toEqual([3, 4, 5]);
  });

  it('counts what was dropped, so the hole does not read as "it did not happen"', () => {
    const queue = new EventQueue(2);
    for (const n of [1, 2, 3, 4]) queue.enqueue(event(n));
    expect(queue.droppedCount).toBe(2);
    queue.clearDropped();
    expect(queue.droppedCount).toBe(0);
  });

  it('a batch that could not be uploaded comes back at the front, without disturbing the order', () => {
    const queue = new EventQueue();
    for (const n of [1, 2]) queue.enqueue(event(n));
    const batch = queue.takeBatch();
    queue.enqueue(event(3));
    queue.returnBatch(batch);
    expect(numbers(queue.takeBatch())).toEqual([1, 2, 3]);
  });

  it('returning a batch that no longer fits loses the batch, not what is happening now', () => {
    const queue = new EventQueue(3);
    for (const n of [1, 2]) queue.enqueue(event(n));
    const batch = queue.takeBatch();
    for (const n of [3, 4, 5]) queue.enqueue(event(n));
    queue.returnBatch(batch);
    expect(numbers(queue.takeBatch())).toEqual([3, 4, 5]);
    expect(queue.droppedCount).toBe(2);
  });

  it('cuts the batch at the function cap: a larger batch is trimmed by the server', () => {
    const queue = new EventQueue(500);
    for (let n = 0; n < 250; n++) queue.enqueue(event(n));
    expect(queue.takeBatch(100)).toHaveLength(100);
    expect(queue.length).toBe(150);
  });
});
