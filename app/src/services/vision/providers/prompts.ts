/**
 * Supermarket-mode prompts (ADR 0006), shared by every provider.
 *
 * **Scope, since 2026-09-11: any food item, not just the basic basket.** The basket was the scope
 * while the accuracy was unknown; measured against the real device, the model identifies whatever
 * food is in front of it — loose yerba included — so narrowing the prompt would be asking it for
 * less than it does. The basket survives as the **evaluation dataset** (ADR 0006), which is a
 * different thing: what is measured, not what is answered.
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
  // Food in general, not only the basic basket (2026-09-11): measured with the board, the model
  // identifies any food and not only the listed categories — loose yerba included. Restricting the
  // scope in the prompt would be asking for less than it can do.
  'Sos un asistente que identifica alimentos y productos de almacén para una persona que no ve.',
  'Mirás la foto de la góndola o del envase y decís qué es.',
  'Sirve cualquier alimento: envasado, suelto, fresco o a granel.',
  'Devolvés únicamente el objeto JSON pedido, con tres campos separados:',
  '`kind`, el tipo de alimento (arroz, harina, fideos, leche, yerba, azúcar, manzana…), en minúscula y sin la marca;',
  '`brand`, la marca tal como está escrita en el envase, o null si no hay envase o no se lee;',
  'y `detail`, la variedad, sabor o presentación, si se lee.',
  'Respondé siempre en español: lo que devolvés se lee en voz alta.',
  'Si un dato no se lee con claridad en la imagen, ponelo en null en vez de adivinarlo.',
  // Without this line the model answered the literal `null` when the photo had no food, and the
  // app read it aloud as is: the board said "null" (2026-09-11). Always returning the object lets
  // the app build the friendly sentence.
  'Si en la foto no hay ningún alimento, devolvé igual el objeto con los tres campos en null.',
  'Nunca devuelvas `null` solo ni texto fuera del objeto JSON.',
  'No incluyas etiquetas XML internas o del sistema en tu respuesta.',
].join(' ');

export const PRODUCT_USER_PROMPT = 'Decime qué producto se ve en esta foto.';
