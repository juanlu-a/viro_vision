/**
 * Persistencia del modelo de nube elegido para el modo supermercado (ADR 0006).
 *
 * Se guarda en AsyncStorage y no en Supabase a propósito: es configuración del modo y tiene que
 * sobrevivir sin red y sin cuenta (la app no tiene login). Se guarda el **id** del modelo, no el
 * perfil entero: el registro de modelos vive en el código y puede cambiar entre versiones — el id
 * guardado se revalida contra los disponibles en `features/reader/modeloSupermercado.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const VISION_MODEL_PREFERENCE_KEY = 'virovision.visionModel';

/** Un id plausible de modelo: string no vacío. La validez real la decide el resolver. */
export function isVisionModelId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Lee el id guardado, o null si no hay nada (o el storage falla): el resolver decide el default. */
export async function loadVisionModelPreference(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(VISION_MODEL_PREFERENCE_KEY);
    return isVisionModelId(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Guarda el id elegido. Un fallo de escritura no debe tumbar la app ni bloquear el cambio. */
export async function saveVisionModelPreference(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(VISION_MODEL_PREFERENCE_KEY, id);
  } catch {
    // El cambio ya se aplicó en memoria; sin persistencia, el próximo arranque vuelve al default.
  }
}
