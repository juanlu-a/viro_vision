/**
 * Cuánto hay que achicar una foto antes de mandarla al modelo de la nube.
 *
 * Módulo puro: sin nativo y sin I/O, para poder testearlo. Ver `redimension.test.ts`.
 */

/**
 * Lado mayor al que se lleva la foto antes de subirla.
 *
 * Una foto de iPhone son ~4000 px de lado: en base64 son varios MB que cruzan el puente JS, viajan
 * por la red y se cobran como tokens de entrada. Los tres son latencia para alguien parado frente a
 * la góndola esperando escuchar qué agarró. Por encima de ~1024 px las APIs de visión reescalan
 * igual para armar su mosaico de tiles, así que lo que se manda de más se paga en transporte sin
 * comprar detalle.
 */
export const LADO_MAYOR_MAX = 1024;

/** Qué lado fijar. El otro lo calcula el manipulador preservando la relación de aspecto. */
export type Redimension = { width: number } | { height: number };

/**
 * Devuelve por qué lado restringir, o `null` si la foto ya entra y no hay que tocarla.
 *
 * Se restringe el lado **mayor**, no siempre el ancho: fijar el ancho de una foto vertical deja el
 * alto por encima del techo, que es justo lo que se quería evitar. Y nunca agranda: una foto ya
 * chica se manda como está — reescalar hacia arriba sólo inventa píxeles y pesa más.
 *
 * Ante dimensiones desconocidas devuelve `null` (no redimensiona) en vez de adivinar: el resultado
 * es correcto, sólo más pesado. La alternativa —fijar un lado a ciegas— puede agrandar una foto
 * chica, que es peor que no hacer nada.
 */
export function calcularRedimension(
  width: number | undefined,
  height: number | undefined,
  max: number = LADO_MAYOR_MAX,
): Redimension | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const w = width as number;
  const h = height as number;
  if (w <= 0 || h <= 0) return null;
  if (w <= max && h <= max) return null;

  return w >= h ? { width: max } : { height: max };
}
