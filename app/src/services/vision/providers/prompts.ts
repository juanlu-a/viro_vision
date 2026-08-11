/**
 * Prompts compartidos por todos los proveedores.
 *
 * Están en un solo lugar a propósito: si cada proveedor tuviera su propio prompt, las diferencias
 * de latencia y precisión que mida el benchmark podrían venir del prompt y no del modelo.
 */

export const SYSTEM_PROMPT = [
  'Sos un lector de carteles de ómnibus del transporte metropolitano de Montevideo.',
  'Devolvés únicamente el objeto JSON pedido, con el número de la línea y su nombre.',
  'Si un dato no se lee con claridad en la imagen, ponelo en null en vez de adivinarlo.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

export const USER_PROMPT =
  'Leé el número y el nombre de la línea en el cartel de este ómnibus.';
