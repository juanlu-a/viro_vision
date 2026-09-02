/**
 * El contrato compartido por todo lo que sale a la nube desde la app.
 *
 * Vive fuera de `services/vision/` porque el proxy de ADR 0008 no es de visión: la síntesis de voz
 * (`services/audio/sintesis.ts`) sale por el mismo camino, y hacerla depender de `services/vision`
 * sería una dependencia inventada entre dos cosas que sólo comparten el transporte.
 */

/**
 * Los proveedores que el proxy sabe alcanzar. **Esta lista tiene que coincidir con la tabla
 * `PROVEEDORES` de `supabase/functions/vision/index.ts`**: son dos archivos que no comparten código
 * —uno corre en Hermes y el otro en Deno— y si se desincronizan, el proxy responde 400 y desde el
 * teléfono no se ve por qué.
 */
export type CloudProviderId = 'gemini' | 'anthropic' | 'openai' | 'groq';

/** Un pedido HTTP ya armado, listo para salir directo o para meterse en el sobre del proxy. */
export interface CloudRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}
