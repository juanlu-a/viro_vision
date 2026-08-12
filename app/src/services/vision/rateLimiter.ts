/**
 * Limitador de tasa por modelo, con ventana móvil.
 *
 * El tier gratuito de Gemini admite 20 requests por minuto **por modelo**. Reaccionar al error de
 * cuota funciona pero es una mala experiencia: la medición se frena 30–60 s sin aviso previo.
 * Acá el límite se respeta *antes* de pedir, así que en el peor caso la app espera un rato con un
 * mensaje claro y nunca falla.
 *
 * Usa `Date.now()` a propósito, no `performance.now()`: la ventana de cuota es tiempo de reloj del
 * lado del servidor, no una duración medida. Es la única parte del benchmark donde corresponde.
 */

/** Ventana de la cuota. */
const WINDOW_MS = 60_000;

/**
 * Tope propio, deliberadamente por debajo de los 20 reales. El margen cubre los requests que el
 * servidor ya contó pero nosotros no (un reintento suyo, una corrida abortada a mitad de vuelo).
 */
const MAX_PER_WINDOW = 17;

/** Marcas de tiempo de los envíos recientes, por modelo: cada modelo tiene su propia cuota. */
const sends = new Map<string, number[]>();

export interface SlotOptions {
  /** Se llama si hay que esperar, con los milisegundos estimados. Para poder avisarlo en la UI. */
  onWait?: (waitMs: number) => void;
  signal?: AbortSignal;
  /** Reloj inyectable para los tests. */
  now?: () => number;
  maxPerWindow?: number;
  /** Espera inyectable para los tests: si no, un test de la ventana tardaría un minuto real. */
  sleep?: (ms: number) => Promise<void>;
}

/** Duerme `ms`, o corta antes si se cancela la corrida. */
function dormir(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    });
  });
}

/** Descarta las marcas que ya salieron de la ventana. */
function prune(modelId: string, now: number): number[] {
  const recent = (sends.get(modelId) ?? []).filter((t) => now - t < WINDOW_MS);
  sends.set(modelId, recent);
  return recent;
}

/**
 * Espera, si hace falta, hasta que haya lugar en la ventana; después registra el envío.
 * Llamarla **antes** de tomar la marca de inicio: la espera no debe contarse como latencia.
 */
export async function acquireSlot(modelId: string, options: SlotOptions = {}): Promise<void> {
  const now = options.now ?? (() => Date.now());
  const max = options.maxPerWindow ?? MAX_PER_WINDOW;

  const sleep = options.sleep ?? ((ms: number) => dormir(ms, options.signal));

  for (;;) {
    // Antes de nada: si ya se canceló, no tiene sentido ni pedir cupo ni esperar por él. Sin este
    // chequeo, una señal abortada *antes* de llegar acá dormiría el minuto entero, porque el
    // evento 'abort' ya pasó y el listener de `dormir` nunca se dispara.
    if (options.signal?.aborted) return;

    const t = now();
    const recent = prune(modelId, t);
    if (recent.length < max) {
      recent.push(t);
      sends.set(modelId, recent);
      return;
    }

    // Hay que esperar a que la marca más vieja salga de la ventana.
    const waitMs = WINDOW_MS - (t - recent[0]) + 250;
    options.onWait?.(waitMs);
    await sleep(waitMs);
  }
}

/** Cuántos envíos quedan disponibles en la ventana actual. Para mostrarlo en la UI. */
export function remainingSlots(
  modelId: string,
  now: number = Date.now(),
  maxPerWindow: number = MAX_PER_WINDOW,
): number {
  return Math.max(0, maxPerWindow - prune(modelId, now).length);
}

/** Sólo para tests: olvida el historial. */
export function resetRateLimiter(): void {
  sends.clear();
}
