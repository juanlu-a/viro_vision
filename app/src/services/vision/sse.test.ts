import { SseOverflowError, parseFrame, readSseStream } from './sse';
import type { SseFrame } from './sse';

/** Fake stream: hands out the given chunks, one per `read()`. Avoids depending on the network. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined };
          const value = encoder.encode(chunks[index]);
          index += 1;
          return { done: false, value };
        },
        // A real reader always exposes cancel(); the reader uses it so it does not leak the
        // socket when it aborts mid-stream.
        async cancel() {
          index = chunks.length;
        },
        releaseLock() {},
      };
    },
  } as unknown as ReadableStream<Uint8Array>;
}

async function collect(chunks: string[]): Promise<{ frames: SseFrame[]; firstByteAt?: number }> {
  const frames: SseFrame[] = [];
  let firstByteAt: number | undefined;
  let clock = 0;

  await readSseStream(streamOf(chunks), (frame) => frames.push(frame), {
    onFirstByte: (at) => (firstByteAt = at),
    now: () => (clock += 10),
  });

  return { frames, firstByteAt };
}

describe('parseFrame', () => {
  it('separates the event from the data', () => {
    expect(parseFrame('event: message_start\ndata: {"type":"message_start"}')).toEqual({
      event: 'message_start',
      data: '{"type":"message_start"}',
    });
  });

  it('joins several data lines with a newline', () => {
    expect(parseFrame('data: uno\ndata: dos')?.data).toBe('uno\ndos');
  });

  it('ignores keep-alive comments', () => {
    expect(parseFrame(': ping')).toBeNull();
  });

  it('returns null when the frame carries no data', () => {
    expect(parseFrame('event: ping')).toBeNull();
  });

  it('keeps spaces beyond the first one after the colon', () => {
    expect(parseFrame('data:  with a space')?.data).toBe(' with a space');
  });
});

describe('readSseStream', () => {
  it('emits one frame per block separated by a blank line', async () => {
    const { frames } = await collect([
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta"}\n\n',
    ]);

    expect(frames.map((frame) => frame.event)).toEqual(['message_start', 'content_block_delta']);
  });

  it('reassembles a frame split across two chunks', async () => {
    const { frames } = await collect(['event: message_st', 'art\ndata: {"a":1}\n\n']);

    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({ event: 'message_start', data: '{"a":1}' });
  });

  it('emits several frames that arrived in the same chunk', async () => {
    const { frames } = await collect(['data: uno\n\ndata: dos\n\ndata: tres\n\n']);

    expect(frames.map((frame) => frame.data)).toEqual(['uno', 'dos', 'tres']);
  });

  it('accepts CRLF separators', async () => {
    const { frames } = await collect(['event: ping\r\ndata: {}\r\n\r\n']);

    expect(frames[0]?.event).toBe('ping');
  });

  it('emits the final frame even when the stream closes without a blank line', async () => {
    const { frames } = await collect(['data: {"type":"message_stop"}']);

    expect(frames).toHaveLength(1);
    expect(frames[0]?.data).toBe('{"type":"message_stop"}');
  });

  it('reports the first byte exactly once, stamped with the first chunk', async () => {
    const { firstByteAt } = await collect(['data: uno\n\n', 'data: dos\n\n']);

    expect(firstByteAt).toBe(10);
  });

  it('emits nothing when the stream comes back empty', async () => {
    const { frames, firstByteAt } = await collect([]);

    expect(frames).toEqual([]);
    expect(firstByteAt).toBeUndefined();
  });
});

describe('protection against a malformed stream', () => {
  it('cuts off with SseOverflowError when a frame separator never arrives', async () => {
    // A 200 that sends bytes forever without the blank line would grow the buffer endlessly.
    const chunks = Array.from({ length: 5 }, () => 'x'.repeat(300));

    await expect(
      readSseStream(streamOf(chunks), () => {}, { maxBufferBytes: 1000, now: () => 0 }),
    ).rejects.toThrow(SseOverflowError);
  });

  it('does not cut off a valid stream whose frames keep closing', async () => {
    const chunks = Array.from({ length: 5 }, () => `data: ${'x'.repeat(300)}\n\n`);
    const frames: SseFrame[] = [];

    await readSseStream(streamOf(chunks), (frame) => frames.push(frame), {
      maxBufferBytes: 1000,
      now: () => 0,
    });

    expect(frames).toHaveLength(5);
  });
});
