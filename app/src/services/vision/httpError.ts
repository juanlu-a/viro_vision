/**
 * Traduce una respuesta HTTP de error de un proveedor al error tipado que la UI sabe leer.
 *
 * Existe por un defecto encontrado midiendo contra la API real (2026-09-02): la cuota **no siempre
 * llega como evento SSE**. Groq la devuelve como **HTTP 429 con cuerpo JSON**, antes de abrir el
 * stream, y por ese camino `reconocerProducto` lanzaba `VisionHttpError` — que la UI no distingue,
 * así que el usuario escuchaba "La nube no respondió" en vez de "Cuota agotada, reintentá en N s".
 * El dato de cuánto esperar llegaba y nadie lo leía; es exactamente el bug que los errores tipados
 * de esta base existen para evitar, repetido en otro camino.
 *
 * Módulo puro: no toca la red. Ver httpError.test.ts.
 */
import { VisionHttpError, VisionQuotaError } from './errors';

/** Espera por defecto cuando el proveedor no dice cuánto. Conservador a propósito. */
export const ESPERA_POR_DEFECTO_S = 30;

/**
 * Los tres proveedores meten el tiempo de reintento **en el texto del mensaje**, con redacciones
 * distintas: Groq y OpenAI dicen "Please try again in 1.17s", Gemini "Please retry in 29.2s".
 * OpenAI además puede darlo en milisegundos ("in 20ms"), que redondeado a 0 s sería un reintento
 * inmediato contra un límite todavía activo.
 */
const REINTENTO = /(?:try again|retry) in ([\d.]+)\s*(ms|s)\b/i;

function segundosDelMensaje(mensaje: string): number | null {
  const m = REINTENTO.exec(mensaje);
  if (!m) return null;
  const valor = Number(m[1]);
  if (!Number.isFinite(valor)) return null;
  return Math.max(1, Math.ceil(m[2].toLowerCase() === 'ms' ? valor / 1000 : valor));
}

/** `Retry-After` es el estándar y le gana al texto: es un número, no una frase que puede cambiar. */
function segundosDelHeader(retryAfter: string | null | undefined): number | null {
  if (!retryAfter) return null;
  const valor = Number(retryAfter);
  return Number.isFinite(valor) && valor >= 0 ? Math.max(1, Math.ceil(valor)) : null;
}

interface CuerpoDeError {
  error?: { message?: unknown; code?: unknown; status?: unknown; type?: unknown };
}

/** Los tres envuelven el detalle en `{ error: { message, code } }`, con variantes en el resto. */
function leerMensaje(body: string): { mensaje: string; code: string } {
  try {
    const parsed = JSON.parse(body) as CuerpoDeError;
    const mensaje = typeof parsed.error?.message === 'string' ? parsed.error.message : body;
    const code = [parsed.error?.code, parsed.error?.status, parsed.error?.type]
      .filter((v): v is string => typeof v === 'string')
      .join(' ');
    return { mensaje, code };
  } catch {
    return { mensaje: body, code: '' };
  }
}

/**
 * `VisionQuotaError` si es cuota —que **se resuelve esperando** y por eso se anuncia distinto—,
 * `VisionHttpError` para todo lo demás.
 *
 * Se decide por el **status 429**, no por el código del proveedor: el 429 es lo único que los tres
 * garantizan igual, y los códigos difieren (`rate_limit_exceeded` en el dialecto OpenAI,
 * `RESOURCE_EXHAUSTED` en Gemini). El código se mira sólo como refuerzo, para el caso de un
 * proveedor que informe cuota con otro status.
 */
export function interpretarErrorHttp(
  status: number,
  body: string,
  retryAfterHeader?: string | null,
): VisionHttpError | VisionQuotaError {
  const { mensaje, code } = leerMensaje(body);
  const esCuota =
    status === 429 || /rate_limit|quota|resource_exhausted/i.test(code);

  if (!esCuota) return new VisionHttpError(status, body);

  const segundos =
    segundosDelHeader(retryAfterHeader) ??
    segundosDelMensaje(mensaje) ??
    ESPERA_POR_DEFECTO_S;

  return new VisionQuotaError(mensaje, segundos);
}
