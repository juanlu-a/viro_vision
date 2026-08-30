/**
 * Camino local del modo ómnibus (ADR 0006): OCR sobre el banner del ómnibus.
 *
 * En el producto, la TPU del dispositivo detecta el ómnibus y manda a la app sólo el recorte del
 * banner (número y destino); acá se lee. Hoy, sin hardware, la app recibe la foto entera desde
 * la fototeca — por eso la heurística de `features/reader/lectura.ts` todavía filtra candidatos.
 * Nada de esto toca la red: es el camino que ADR 0001 exige que funcione sin internet.
 */
export { cargarOcr, leerImagen, liberarOcr, ocrCargado } from './ocr';
export type { LecturaOcr } from './ocr';
