/**
 * A Server-Sent Events reader over a web ReadableStream.
 *
 * It exists instead of using `@anthropic-ai/sdk` for two reasons:
 *   1. The SDK states in its README that React Native is not supported.
 *   2. For a benchmark the instrument has to be thinner than what it measures: the SDK's decoder
 *      would sit between the network and the timestamp, and it exposes neither the moment the
 *      headers arrive nor the first byte.
 *
 * Pure, transport-agnostic module: it is tested with a fake stream (see sse.test.ts).
 * Expo installs `TextDecoder` and `ReadableStream` as globals before the main module.
 */

export interface SseFrame {
  /** Value of the `event:` line, or null when the frame does not carry one. */
  event: string | null;
  /** `data:` lines joined with \n. */
  data: string;
}

export interface ReadSseOptions {
  /** Called exactly once, when the first chunk with data arrives. */
  onFirstByte?: (at: number) => void;
  /** Injectable clock so it can be tested. Defaults to `performance.now()`. */
  now?: () => number;
  /** Ceiling for the buffer without a separator. Defaults to {@link MAX_BUFFER_BYTES}. */
  maxBufferBytes?: number;
}

/**
 * Ceiling for the buffer between frame separators. A server that answers 200 but never sends the
 * blank line (a bug, a broken proxy) would grow the buffer without limit until the app hangs. A
 * legitimate frame from these APIs is a few kB; 4 MB is very generous and still bounds the damage.
 */
export const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

/** Thrown when the stream does not respect the SSE format and the buffer overflows. */
export class SseOverflowError extends Error {
  constructor(bytes: number) {
    super(`SSE_BUFFER_OVERFLOW_${bytes}`);
    this.name = 'SseOverflowError';
  }
}

/**
 * Consumes the stream to the end, invoking `onFrame` for each complete event.
 * `receivedAt` is the instant the chunk that closed that frame was read — not the instant parsing
 * finished.
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: SseFrame, receivedAt: number) => void,
  options: ReadSseOptions = {},
): Promise<void> {
  const now = options.now ?? (() => performance.now());
  const maxBuffer = options.maxBufferBytes ?? MAX_BUFFER_BYTES;
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let sawFirstByte = false;
  /** Arrival of the last chunk with data. The trailing frame is stamped with this and not with
   *  `now()` after the close, which would add the connection-close round trip. */
  let lastReceivedAt = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      const receivedAt = now();
      lastReceivedAt = receivedAt;
      if (!sawFirstByte) {
        sawFirstByte = true;
        options.onFirstByte?.(receivedAt);
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. \r\n\r\n in case there are proxies.
      let separator = findSeparator(buffer);
      while (separator !== null) {
        const rawFrame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator.length);
        const frame = parseFrame(rawFrame);
        if (frame) onFrame(frame, receivedAt);
        separator = findSeparator(buffer);
      }

      // If no separator was left and the buffer kept growing, the stream is not valid SSE.
      if (buffer.length > maxBuffer) throw new SseOverflowError(buffer.length);
    }

    // Trailing frame with no final blank line (some servers close without it).
    buffer += decoder.decode();
    const trailing = parseFrame(buffer);
    if (trailing) onFrame(trailing, lastReceivedAt || now());
  } catch (err) {
    // Without cancel(), a throw mid-stream releases the lock but leaves the socket alive.
    await reader.cancel().catch(() => {});
    throw err;
  } finally {
    reader.releaseLock();
  }
}

function findSeparator(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1 && crlf === -1) return null;
  if (crlf !== -1 && (lf === -1 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

/** Parses a raw frame. Returns null when it has no `data:` line at all. */
export function parseFrame(raw: string): SseFrame | null {
  const lines = raw.split(/\r?\n/);
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.length === 0 || line.startsWith(':')) continue; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // The spec allows a single optional space after the colon.
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
