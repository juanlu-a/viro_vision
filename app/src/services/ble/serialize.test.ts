/**
 * Exists because of the failure this serializer was written for, which was invisible in every way a
 * bug can be invisible: nothing threw, nothing was logged, the tests passed, and the symptom was the
 * phone reporting it could not join the board's network — a sentence that points at the WiFi, three
 * layers away from the BLE write that actually caused it.
 *
 * What is asserted here is the part that made it possible: two characteristic operations in flight
 * at the same time, because one caller did not `await`. The queue has to survive a failure too — the
 * board goes out of range routinely, and a queue that stops at the first rejection would take the
 * announcement path down with it.
 */
import { createSerializer } from './serialize';

/** A deferred promise, so a test can decide exactly when an operation finishes. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSerializer', () => {
  it('never runs two operations at once, even when the caller does not await', async () => {
    // This is the bug, reduced: `notify()` wrote to `control` without awaiting, one line before the
    // connection sequence read `wifi`. Both were in flight on a peripheral that had just connected.
    const serialize = createSerializer();
    const running: string[] = [];
    const order: string[] = [];
    let overlapped = false;

    const operation = (name: string, ms: number) => async () => {
      running.push(name);
      if (running.length > 1) overlapped = true;
      await new Promise((r) => setTimeout(r, ms));
      running.splice(running.indexOf(name), 1);
      order.push(name);
    };

    // The write is fired and forgotten, exactly as the announcement path does it.
    void serialize(operation('write', 20));
    await serialize(operation('read', 1));

    expect(overlapped).toBe(false);
    // And the order asked for is the order that happened: the read waited for the write.
    expect(order).toEqual(['write', 'read']);
  });

  it('keeps going after an operation rejects', async () => {
    // A read on a link that just died rejects. If that stopped the queue, every later notice and
    // every later mode write would hang forever — a far worse failure than the one being handled.
    const serialize = createSerializer();
    const failed = serialize(() => Promise.reject(new Error('link gone')));

    await expect(failed).rejects.toThrow('link gone');
    await expect(serialize(() => Promise.resolve('still works'))).resolves.toBe('still works');
  });

  it('gives each caller its own result, not the queue’s', async () => {
    const serialize = createSerializer();
    const results = await Promise.all([
      serialize(() => Promise.resolve(1)),
      serialize(() => Promise.resolve(2)),
      serialize(() => Promise.resolve(3)),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('does not report an unhandled rejection when the caller handles its own error', async () => {
    // The queue keeps the settling of each operation, never its rejection. Keeping the rejected
    // promise as the tail would surface as a crash in a release build although nothing was wrong.
    const serialize = createSerializer();
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', listener);

    await serialize(() => Promise.reject(new Error('handled here'))).catch(() => {});
    await serialize(() => Promise.resolve('next'));
    // Let the microtask queue drain so a stray rejection would have been reported by now.
    await new Promise((r) => setTimeout(r, 10));

    process.off('unhandledRejection', listener);
    expect(unhandled).toEqual([]);
  });

  it('starts the first operation without waiting for anything', async () => {
    // The chirp is the first sound of a reading and it cannot pay a queue it is alone in.
    const serialize = createSerializer();
    const started = deferred<void>();
    void serialize(async () => {
      started.resolve();
      await new Promise((r) => setTimeout(r, 50));
    });
    // Resolves on its own without the operation having finished.
    await expect(started.promise).resolves.toBeUndefined();
  });
});
