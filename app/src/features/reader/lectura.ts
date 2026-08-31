/**
 * La parte pura del lector: qué se considera una lectura y cómo se convierte en frase hablada.
 *
 * Vive fuera del hook porque la voz ES la interfaz de esta app: una regresión acá no se ve en
 * ninguna pantalla, se escucha — y sin tests, nadie la escucha antes que el usuario. Ver
 * lectura.test.ts.
 */
import { strings } from '@/i18n';
import type { ProductoLeido } from '@/services/vision';

const t = strings.reader;

/**
 * Lo que el anuncio de ómnibus necesita: número de línea y destino. Vive acá y no en la capa de
 * nube porque el camino de ómnibus es local (ADR 0006) y no debe importar nada de `services/vision`.
 */
export interface BusReading {
  /** Número de línea del cartel frontal (ej. "116"), o null si no se pudo leer. */
  numero: string | null;
  /** Nombre / destino de la línea (ej. "Plaza Independencia"), o null. */
  nombre: string | null;
}

/** Duración legible para la fila "Tiempo" del resultado. Guion cuando no hubo medición. */
export function formatMs(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

/** Con 2-4 dígitos y confianza razonable, es candidata a número de línea. */
export function adivinarLectura(textos: { text: string; score: number }[]): BusReading {
  const numero = textos.find((d) => /^\d{2,4}$/.test(d.text.trim()) && d.score > 0.3);
  const nombre = textos.find(
    (d) => d !== numero && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(d.text) && d.score > 0.3,
  );
  return { numero: numero?.text.trim() ?? null, nombre: nombre?.text.trim() ?? null };
}

/** La frase que se anuncia en modo ómnibus. El texto crudo es el respaldo, nunca el silencio. */
export function frasearLectura(lectura: BusReading | null, crudo: string | null): string {
  if (lectura?.numero && lectura?.nombre) return `${t.line} ${lectura.numero}, ${lectura.nombre}`;
  if (lectura?.numero) return `${t.line} ${lectura.numero}`;
  if (lectura?.nombre) return lectura.nombre;
  if (crudo) return crudo;
  return t.nothingRead;
}

/**
 * La frase que se anuncia en modo supermercado: tipo, marca y recién después el detalle.
 *
 * El orden no es cosmético. Quien no ve escucha la frase entera antes de poder decidir, así que
 * adelante va lo que más discrimina: "arroz Saman, Blue Patna 1 kg" y no "Blue Patna 1 kg, arroz".
 * Cada campo puede faltar por separado (el modelo devuelve null lo que no lee), y decir dos de tres
 * sigue siendo útil — por eso se arma con los que haya en vez de exigirlos todos. El texto crudo es
 * el respaldo, nunca el silencio.
 */
export function frasearProducto(producto: ProductoLeido | null, crudo: string | null): string {
  const cabeza = [producto?.tipo, producto?.marca].filter(Boolean).join(' ');
  const partes = [cabeza, producto?.detalle].filter(Boolean);
  if (partes.length > 0) return partes.join(', ');
  if (crudo) return crudo;
  return t.nothingReadProduct;
}
