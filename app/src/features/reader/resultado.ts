/**
 * Las filas legibles del resultado de una lectura, para la pantalla. La VOZ dice la frase de
 * `frasearProducto` / `frasearLectura`; esto es el registro visual para quien sí ve, o para quien
 * revisa con el lector de pantalla fila por fila. Puro, para testearlo: si "Marca" mostrara el tipo
 * o un campo nulo se imprimiera como "null", la pantalla mentiría sin que nadie lo note.
 */
import { strings } from '@/i18n';
import type { ProductoLeido } from '@/services/vision';

import type { BusReading } from './lectura';

const t = strings.reader;

export interface FilaResultado {
  etiqueta: string;
  valor: string;
  /** True cuando el modelo no pudo leer ese campo: se muestra atenuado y la voz lo dice como "sin leer". */
  vacio: boolean;
}

function fila(etiqueta: string, valor: string | null | undefined): FilaResultado {
  const limpio = valor?.trim() ?? '';
  return limpio ? { etiqueta, valor: limpio, vacio: false } : { etiqueta, valor: t.fieldUnread, vacio: true };
}

export function filasDeProducto(producto: ProductoLeido): FilaResultado[] {
  return [fila(t.productField, producto.tipo), fila(t.brandField, producto.marca), fila(t.detailField, producto.detalle)];
}

export function filasDeLinea(lectura: BusReading): FilaResultado[] {
  return [fila(t.line, lectura.numero), fila(t.destinationField, lectura.nombre)];
}
