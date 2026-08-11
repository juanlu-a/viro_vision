/**
 * Lector de Server-Sent Events sobre un ReadableStream web.
 *
 * Existe en vez de usar `@anthropic-ai/sdk` por dos razones:
 *   1. El SDK declara en su README que React Native no está soportado.
 *   2. Para un benchmark el instrumento tiene que ser más delgado que lo medido: el decoder del
 *      SDK se interpondría entre la red y el timestamp, y no expone el momento en que llegan
 *      los headers ni el primer byte.
 *
 * Módulo puro y agnóstico del transporte: se testea con un stream falso (ver sse.test.ts).
 * `TextDecoder` y `ReadableStream` los instala Expo como globales antes del módulo principal.
 */

export interface SseFrame {
  /** Valor de la línea `event:`, o null si el frame no la trae. */
  event: string | null;
  /** Líneas `data:` concatenadas con \n. */
  data: string;
}

export interface ReadSseOptions {
  /** Se llama una sola vez, cuando llega el primer chunk con datos. */
  onFirstByte?: (at: number) => void;
  /** Reloj inyectable para poder testear. Por defecto `performance.now()`. */
  now?: () => number;
  /** Techo del buffer sin separador. Por defecto {@link MAX_BUFFER_BYTES}. */
  maxBufferBytes?: number;
}

/**
 * Techo del buffer entre separadores de frame. Un servidor que responde 200 pero nunca manda la
 * línea en blanco (bug, proxy roto) haría crecer el buffer sin límite hasta colgar la app. Un
 * frame legítimo de estas APIs son unos pocos kB; 4 MB es holgadísimo y aun así acota el daño.
 */
export const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

/** Se lanza cuando el stream no respeta el formato SSE y el buffer se desborda. */
export class SseOverflowError extends Error {
  constructor(bytes: number) {
    super(`SSE_BUFFER_OVERFLOW_${bytes}`);
    this.name = 'SseOverflowError';
  }
}

/**
 * Consume el stream hasta el final, invocando `onFrame` por cada evento completo.
 * `receivedAt` es el instante en que se leyó el chunk que cerró ese frame — no el instante
 * en que se terminó de parsear.
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

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      const receivedAt = now();
      if (!sawFirstByte) {
        sawFirstByte = true;
        options.onFirstByte?.(receivedAt);
      }

      buffer += decoder.decode(value, { stream: true });

      // Los frames SSE se separan con una línea en blanco. \r\n\r\n por si hay proxies.
      let separator = findSeparator(buffer);
      while (separator !== null) {
        const rawFrame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator.length);
        const frame = parseFrame(rawFrame);
        if (frame) onFrame(frame, receivedAt);
        separator = findSeparator(buffer);
      }

      // Si no quedó ningún separador y el buffer siguió creciendo, el stream no es SSE válido.
      if (buffer.length > maxBuffer) throw new SseOverflowError(buffer.length);
    }

    // Cola sin línea en blanco final (algunos servidores cierran sin ella).
    buffer += decoder.decode();
    const trailing = parseFrame(buffer);
    if (trailing) onFrame(trailing, now());
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

/** Parsea un frame crudo. Devuelve null si no tiene ninguna línea `data:`. */
export function parseFrame(raw: string): SseFrame | null {
  const lines = raw.split(/\r?\n/);
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.length === 0 || line.startsWith(':')) continue; // comentario / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // La espec. permite un único espacio opcional después de los dos puntos.
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
