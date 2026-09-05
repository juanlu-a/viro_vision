/**
 * Descarga por HTTP desde la placa y medición del tiempo: el camino de la foto que decidió el
 * ADR 0003 (WiFi, 46 ms contra 4,5 s por BLE, medido el 2026-09-05).
 *
 * REGLA DE FRONTERA (ADR 0003): esto habla con la placa en la red local, nunca con internet. El
 * teléfono tiene que conservar su internet (datos o WiFi) mientras tanto; si la placa está en la
 * misma red que el teléfono no hay conflicto, y si la placa fuera el punto de acceso el sistema
 * tiene que enrutar internet por datos (spike pendiente). Sin TLS a propósito: WPA2 ya cifra el
 * aire y los datos no son sensibles; por eso `app.json` permite HTTP plano sólo hacia red local.
 *
 * Módulo PURO: `fetch` y el reloj se inyectan para testearlo sin red.
 */
import type { MedicionTransferencia } from '@/services/ble/transferencia';

export class HttpDescargaError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = 'HttpDescargaError';
  }
}

export interface DireccionPlaca {
  ip: string;
  puerto: number;
}

export function urlDeLaPlaca({ ip, puerto }: DireccionPlaca, ruta: string): string {
  return `http://${ip}:${puerto}${ruta}`;
}

interface Dependencias {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

/**
 * Baja `url` entera y mide del envío del pedido al último byte recibido. Devuelve la misma forma
 * que la medición BLE para que la UI y la voz las cuenten igual: un solo "paquete" del tamaño del
 * cuerpo, porque HTTP no expone la fragmentación.
 */
export async function medirDescargaHttp(
  url: string,
  { fetchImpl = fetch, now = Date.now, timeoutMs = 15_000 }: Dependencias = {}
): Promise<MedicionTransferencia> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  const t0 = now();
  let respuesta: Response;
  try {
    respuesta = await fetchImpl(url, { signal: controlador.signal, cache: 'no-store' });
  } catch (err) {
    clearTimeout(timer);
    const motivo = err instanceof Error ? err.message : String(err);
    throw new HttpDescargaError(controlador.signal.aborted ? `sin respuesta en ${timeoutMs / 1000} s` : motivo);
  }
  if (!respuesta.ok) {
    clearTimeout(timer);
    throw new HttpDescargaError(`la placa respondió ${respuesta.status}`, respuesta.status);
  }
  let cuerpo: ArrayBuffer;
  try {
    cuerpo = await respuesta.arrayBuffer();
  } catch (err) {
    throw new HttpDescargaError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
  const ms = Math.max(1, now() - t0);
  const bytes = cuerpo.byteLength;
  return { bytes, chunks: 1, chunkBytes: bytes, ms, kbps: bytes / ms };
}
