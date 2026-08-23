/**
 * Prompts compartidos por todos los proveedores.
 *
 * Están en un solo lugar a propósito: si cada proveedor tuviera su propio prompt, las diferencias
 * de latencia y precisión que mida el benchmark podrían venir del prompt y no del modelo.
 */

export const SYSTEM_PROMPT = [
  'Sos un lector de carteles de ómnibus del transporte metropolitano de Montevideo.',
  'Leés el cartel LUMINOSO del frente, el que anuncia la línea y el destino.',
  // Medido en el teléfono: sin esta frase, el modelo local leyó la matrícula ("94") en vez del
  // cartel ("427 PORTONES"). La matrícula suele ser el texto más nítido de la foto.
  'La matrícula (chapa de patente) NO es el cartel: ignorala.',
  'Devolvés únicamente el objeto JSON pedido, con el número de la línea y su nombre.',
  'Si un dato no se lee con claridad en la imagen, ponelo en null en vez de adivinarlo.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

/**
 * Para los caminos SIN decodificado restringido (hoy, ExecuTorch): la forma exacta del JSON tiene
 * que ir en el prompt, porque nadie más la garantiza. En la nube y en LiteRT la garantiza el
 * schema y este sufijo no hace falta — medido: sin él, el modelo local inventó las claves
 * ("line_number"/"line_name") y el parser compartido no las reconoció.
 */
export const JSON_SHAPE_PROMPT =
  'Respondé SOLO este JSON, con exactamente estas claves: {"numero": "...", "nombre": "..."}';

export const USER_PROMPT =
  'Leé el número y el nombre de la línea en el cartel de este ómnibus.';

/**
 * Caso de uso supermercado (ADR 0006). Un solo prompt para el candidato nube y el candidato
 * local, por la misma razón que arriba: la comparación que cierra la decisión pendiente tiene
 * que medir el modelo, no el prompt.
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

/** Mismo motivo que JSON_SHAPE_PROMPT: en los caminos sin decodificado restringido, la forma
 * exacta del JSON tiene que ir en el prompt porque nadie más la garantiza. */
export const PRODUCTO_JSON_SHAPE_PROMPT =
  'Respondé SOLO este JSON, con exactamente estas claves: {"producto": "...", "detalle": "..."}';
