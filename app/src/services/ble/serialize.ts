/**
 * One GATT operation at a time, in the order they were asked for.
 *
 * **Why this exists**, and it is worth reading before deciding it is ceremony. On 2026-09-17, with
 * the output set to the device, the app could no longer join the board's WiFi: the phone connected
 * over BLE and then reported that it could not use the device's network. With the output on the
 * phone, the very same build worked.
 *
 * The difference was one line added the day before. `DeviceProvider` announces "dispositivo
 * conectado" the instant the link comes up, and when the announcement goes to the board that is a
 * **GATT write on `control`** — fired without `await`, one line before the app **reads** the `wifi`
 * characteristic to learn the AP's credentials. Two characteristic operations on the same freshly
 * connected peripheral, in flight at once. The read came back empty, `readWifi()` answers `null` for
 * every failure, and with no credentials there is nothing to join.
 *
 * It would have been easy to move that one line after the read. That is the fix this file exists
 * **instead of**: the same shape is already in the code somewhere else — `applyGesture` announces the
 * mode and writes it to the device in the next statement, also unawaited — and the class of bug is
 * one where nothing throws and nothing is logged. A notice is the least important thing the link
 * carries, and it was silently outranking the thing the whole product needs.
 *
 * So the rule is on the transport and not on the caller: **the order operations are asked for is the
 * order they happen.** A caller that forgets to `await` gets queued instead of racing.
 *
 * It is a queue, not a lock: nothing is dropped and nothing needs to know about anything else. It
 * does not serialize notifications (`monitorCharacteristicForDevice`), which are not operations —
 * they arrive when the board decides, and holding them back would delay the button.
 */

/**
 * Runs `operation`s one after another, never concurrently.
 *
 * Each call resolves or rejects exactly as its operation does; a failure does **not** poison the
 * queue, because the announcement path must survive a read that timed out on a dead link.
 */
export function createSerializer(): <T>(operation: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    // `then(op, op)`, not `then(op)`: a rejected predecessor must still let the next one run. The
    // alternative is a queue that stops forever the first time the board goes out of range.
    const result = tail.then(operation, operation);
    // The chain keeps the *settling*, never the rejection: an unhandled rejection here would be
    // reported as a crash in a release build even though the caller handled its own error.
    tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}
