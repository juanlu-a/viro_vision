/**
 * Resuelve qué modelo de nube usa el modo supermercado, a partir del id guardado y de los modelos
 * realmente disponibles en ESTE build (sólo los de proveedores con clave).
 *
 * Existe porque un id guardado puede quedar inválido sin que el usuario haga nada: el modelo se
 * retira del registro en una versión nueva, o este build no trae la clave de su proveedor. Sin
 * esta revalidación, el modo fallaría en cada lectura con un modelo que no existe.
 */
import { DEFAULT_PRODUCTO_MODEL_ID } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

export function resolveProductoModel(
  storedId: string | null,
  available: readonly ModelProfile[],
): ModelProfile | null {
  if (available.length === 0) return null; // sin claves: el modo avisa, no adivina
  const stored = storedId ? available.find((m) => m.id === storedId) : undefined;
  if (stored) return stored;
  return available.find((m) => m.id === DEFAULT_PRODUCTO_MODEL_ID) ?? available[0];
}
