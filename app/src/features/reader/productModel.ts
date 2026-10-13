/**
 * Resolves which cloud model supermarket mode uses, from the stored id and from the models
 * actually available in THIS build (only those whose provider has a key).
 *
 * It exists because a stored id can turn invalid without the user doing anything: the model is
 * retired from the registry in a new version, or this build does not ship its provider's key.
 * Without this revalidation the mode would fail on every reading with a model that does not exist.
 */
import { DEFAULT_PRODUCT_MODEL_ID } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

export function resolveProductModel(
  storedId: string | null,
  available: readonly ModelProfile[],
): ModelProfile | null {
  if (available.length === 0) return null; // no keys: the mode says so, it does not guess
  const stored = storedId ? available.find((m) => m.id === storedId) : undefined;
  if (stored) return stored;
  return available.find((m) => m.id === DEFAULT_PRODUCT_MODEL_ID) ?? available[0];
}
