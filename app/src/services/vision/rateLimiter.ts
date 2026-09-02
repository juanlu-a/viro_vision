/**
 * Limitador de tasa por modelo, con ventana móvil.
 *
 * El tier gratuito de Gemini admite 20 requests por minuto **por modelo**. Reaccionar al error de
 * cuota funciona pero es una mala experiencia: el modo supermercado se frena 30–60 s sin aviso
 * previo. Acá el límite se respeta *antes* de pedir, así que en el peor caso la app espera un
 * rato con un mensaje claro y nunca falla.
 *
 * Usa `Date.now()` a propósito, no `performance.now()`: la ventana de cuota es tiempo de reloj del
 * lado del servidor, no una duración medida.
 */
import type { VisionProviderId } from './types';

/** Ventana de la cuota. */
const WINDOW_MS = 60_000;

/**
 * Tope por minuto y por modelo, **según el proveedor**.
 *
 * Antes había un solo número, 17, calibrado al tier gratuito de Gemini. Imponérselo a un proveedor
 * pago desperdicia justamente la razón de haberlo pagado: le pone el techo del más restringido al
 * que no lo tiene.
 *
 * Los dos gratuitos llevan margen sobre el límite real, para cubrir los requests que el servidor
 * ya contó y nosotros no (un reintento suyo, una corrida abortada a mitad de vuelo). Los pagos
 * llevan un número alto a propósito: ahí el limitador **deja de ser la pared del tier gratuito y
 * pasa a ser un tope de seguridad** contra un bucle desbocado que queme crédito. El límite real de
 * una cuenta paga depende de su tier y no lo podemos saber desde acá.
 */
const LIMITE_POR_PROVEEDOR: Record<VisionProviderId, number> = {
  gemini: 17, // 20/min por modelo en el tier gratuito, medido el 30/08/2026
  // OJO: el tier gratuito de Groq limita por **tokens** por minuto, no por requests. Medido el
  // 2026-09-02: el límite es 8000 TPM y una foto cuesta ~1974 tokens de entrada (Groq cobra la
  // imagen a tarifa fija, así que achicarla no lo baja), o sea **~4 lecturas por minuto**. El 25
  // que había acá era el número de un límite por requests que este proveedor no tiene, y hacía que
  // el limitador no frenara nunca: la tercera lectura seguida ya daba 429.
  groq: 3,
  openai: 100, // muy por encima de lo que alguien hace a mano: es freno de emergencia, no cuota
  anthropic: 40,
};

/** El tope por defecto si no se dice otra cosa: el más restrictivo, que nunca rompe. */
const MAX_PER_WINDOW = LIMITE_POR_PROVEEDOR.gemini;

/** Cuántas lecturas por minuto tolera un proveedor. Lo pasa `reconocerProducto` al pedir cupo. */
export function limitePorMinuto(provider: VisionProviderId): number {
  return LIMITE_POR_PROVEEDOR[provider];
}

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
