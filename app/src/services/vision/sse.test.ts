import { SseOverflowError, parseFrame, readSseStream } from './sse';
import type { SseFrame } from './sse';

/** Stream falso: entrega los chunks dados, uno por `read()`. Evita depender de la red. */
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
        // Un reader real siempre expone cancel(); el lector lo usa para no filtrar el socket
        // cuando aborta a mitad de stream.
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
  it('separa el event del data', () => {
    expect(parseFrame('event: message_start\ndata: {"type":"message_start"}')).toEqual({
      event: 'message_start',
      data: '{"type":"message_start"}',
    });
  });

  it('concatena varias líneas data con salto de línea', () => {
    expect(parseFrame('data: uno\ndata: dos')?.data).toBe('uno\ndos');
  });

  it('ignora los comentarios de keep-alive', () => {
    expect(parseFrame(': ping')).toBeNull();
  });

  it('devuelve null si el frame no trae data', () => {
    expect(parseFrame('event: ping')).toBeNull();
  });

  it('conserva los espacios más allá del primero tras los dos puntos', () => {
    expect(parseFrame('data:  con espacio')?.data).toBe(' con espacio');
  });
});

describe('readSseStream', () => {
  it('emite un frame por cada bloque separado por línea en blanco', async () => {
    const { frames } = await collect([
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta"}\n\n',
    ]);

    expect(frames.map((frame) => frame.event)).toEqual(['message_start', 'content_block_delta']);
  });

  it('reensambla un frame partido entre dos chunks', async () => {
    const { frames } = await collect(['event: message_st', 'art\ndata: {"a":1}\n\n']);

    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({ event: 'message_start', data: '{"a":1}' });
  });

  it('emite varios frames que llegaron en un mismo chunk', async () => {
    const { frames } = await collect(['data: uno\n\ndata: dos\n\ndata: tres\n\n']);

    expect(frames.map((frame) => frame.data)).toEqual(['uno', 'dos', 'tres']);
  });

  it('acepta separadores CRLF', async () => {
    const { frames } = await collect(['event: ping\r\ndata: {}\r\n\r\n']);

    expect(frames[0]?.event).toBe('ping');
  });

  it('emite el frame final aunque el stream cierre sin línea en blanco', async () => {
    const { frames } = await collect(['data: {"type":"message_stop"}']);

    expect(frames).toHaveLength(1);
    expect(frames[0]?.data).toBe('{"type":"message_stop"}');
  });

  it('avisa del primer byte una sola vez y con la marca del primer chunk', async () => {
    const { firstByteAt } = await collect(['data: uno\n\n', 'data: dos\n\n']);

    expect(firstByteAt).toBe(10);
  });

  it('no emite nada si el stream viene vacío', async () => {
    const { frames, firstByteAt } = await collect([]);

    expect(frames).toEqual([]);
    expect(firstByteAt).toBeUndefined();
  });
});

describe('protección contra stream malformado', () => {
  it('corta con SseOverflowError si nunca llega un separador de frame', async () => {
    // Un 200 que manda bytes para siempre sin la línea en blanco haría crecer el buffer sin fin.
    const chunks = Array.from({ length: 5 }, () => 'x'.repeat(300));

    await expect(
      readSseStream(streamOf(chunks), () => {}, { maxBufferBytes: 1000, now: () => 0 }),
    ).rejects.toThrow(SseOverflowError);
  });

  it('no corta un stream válido cuyos frames van cerrando', async () => {
    const chunks = Array.from({ length: 5 }, () => `data: ${'x'.repeat(300)}\n\n`);
    const frames: SseFrame[] = [];

    await readSseStream(streamOf(chunks), (frame) => frames.push(frame), {
      maxBufferBytes: 1000,
      now: () => 0,
    });

    expect(frames).toHaveLength(5);
  });
});
