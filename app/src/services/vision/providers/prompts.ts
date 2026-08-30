/**
 * Prompts del modo supermercado (ADR 0006), compartidos por todos los proveedores.
 *
 * Están en un solo lugar a propósito: si cada proveedor tuviera su propio prompt, elegir otro
 * modelo en el selector de Inicio cambiaría también la pregunta, y las diferencias de precisión
 * entre modelos podrían venir del prompt y no del modelo.
 *
 * No hay prompt de ómnibus: ese caso corre local (OCR sobre el banner recortado por la TPU) y
 * nunca va a la nube — la latencia manda (ADR 0006).
 */

export const PRODUCTO_SYSTEM_PROMPT = [
  'Sos un asistente que identifica productos de supermercado de la canasta básica',
  'para una persona que no ve.',
  'Mirás la foto de la góndola o del envase y decís qué producto es.',
  'Devolvés únicamente el objeto JSON pedido: el nombre del producto (qué es y su marca)',
  'y el detalle (variedad, sabor o presentación), si se lee.',
  'Si un dato no se lee con claridad en la imagen, ponelo en null en vez de adivinarlo.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

export const PRODUCTO_USER_PROMPT = 'Decime qué producto se ve en esta foto.';
