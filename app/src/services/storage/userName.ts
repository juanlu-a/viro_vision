/**
 * Nombre del usuario, opcional, para el saludo de Inicio.
 *
 * En AsyncStorage y no en Supabase, por la misma razón que el tema: la app no tiene login
 * (ADR 0002) y un saludo no justifica una cuenta. Vacío significa "no quiso ponerlo" y la app no
 * insiste.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_NAME_KEY = 'virovision.userName';

export async function loadUserName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(USER_NAME_KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function saveUserName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_NAME_KEY, name.trim());
  } catch {
    /* sigue valiendo en memoria durante la sesión */
  }
}
