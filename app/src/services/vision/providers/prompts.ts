/**
 * Supermarket-mode prompts (ADR 0006), shared by every provider.
 *
 * They live in a single place on purpose: if each provider had its own prompt, picking another
 * model in the Home selector would also change the question, and accuracy differences between
 * models could come from the prompt rather than from the model.
 *
 * The prompt text is Spanish because the answer is spoken to the user in Spanish: the field values
 * ARE app content, not code. The field NAMES are English, matching `productSchema`.
 *
 * There is no bus prompt: that case runs locally (OCR over the banner cropped by the TPU) and never
 * goes to the cloud — latency rules (ADR 0006).
 */

export const PRODUCT_SYSTEM_PROMPT = [
  'Sos un asistente que identifica productos de supermercado de la canasta básica',
  'para una persona que no ve.',
  'Mirás la foto de la góndola o del envase y decís qué producto es.',
  'Devolvés únicamente el objeto JSON pedido, con tres campos separados:',
  '`kind`, el tipo de producto (arroz, harina, fideos, leche, yerba, azúcar…), en minúscula y sin la marca;',
  '`brand`, la marca tal como está escrita en el envase;',
  'y `detail`, la variedad, sabor o presentación, si se lee.',
  'Respondé siempre en español: lo que devolvés se lee en voz alta.',
  'Si un dato no se lee con claridad en la imagen, ponelo en null en vez de adivinarlo.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

export const PRODUCT_USER_PROMPT = 'Decime qué producto se ve en esta foto.';
