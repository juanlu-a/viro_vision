/**
 * De dónde sale la URL de la función `telemetria`.
 *
 * Dos fuentes, en este orden: la variable propia si está, y si no **derivarla de la del proxy de
 * visión**, que apunta a otra función del mismo proyecto de Supabase.
 *
 * Lo segundo se rescató de la rama `feat/telemetria-supabase` (2026-09-07) y vale por una razón
 * operativa concreta: sin eso, un build que tiene el proxy configurado pero no el secret nuevo sale
 * **sin ninguna telemetría** y nadie se entera hasta que hace falta diagnosticar algo. Las dos URLs
 * viven siempre en el mismo proyecto, así que pedirlas por separado es pedir dos veces el mismo
 * dato y dejar que se desincronicen.
 *
 * Módulo puro: la derivación se testea sin red y sin entorno.
 */

/**
 * `…/functions/v1/vision` → `…/functions/v1/telemetria`.
 *
 * Devuelve `null` si la URL no termina en `/vision`, en vez de intentar adivinar: una URL armada a
 * la fuerza daría 404 en cada lote y la cola se llenaría de reintentos contra un endpoint que no
 * existe. Mejor apagada y sabida que encendida y rota.
 */
export function urlDeTelemetria(proxyUrl: string | undefined | null): string | null {
  if (!proxyUrl) return null;
  const sinBarra = proxyUrl.replace(/\/+$/, '');
  // El esquema se saca ANTES de comparar: `https://vision` también "termina en /vision" —por la
  // doble barra— y sin esto derivaba `https:/telemetria`, una URL rota que daría 404 en cada lote.
  const sinEsquema = sinBarra.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return sinEsquema.endsWith('/vision')
    ? `${sinBarra.slice(0, -'/vision'.length)}/telemetria`
    : null;
}

/**
 * La URL efectiva. Los dos parámetros entran por argumento y no se leen de `process.env` acá
 * adentro para que el test mida el código y no el entorno donde corre (la lección del fallo de
 * TestFlight del 2026-09-02).
 */
export function resolverUrlDeTelemetria(
  propia: string | undefined | null,
  proxy: string | undefined | null
): string {
  if (propia) return propia;
  return urlDeTelemetria(proxy) ?? '';
}
