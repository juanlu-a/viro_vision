/**
 * Existe porque el storage puede fallar o traer basura (versión vieja, clave corrupta) y el modo
 * supermercado no puede romperse por eso: ante cualquier problema se devuelve null y el resolver
 * cae al default. Primer test de la base que toca AsyncStorage: usa el mock oficial del paquete.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  VISION_MODEL_PREFERENCE_KEY,
  isVisionModelId,
  loadVisionModelPreference,
  saveVisionModelPreference,
} from './visionModelPreference';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- la factory de jest.mock corre antes que los imports; require es la forma documentada del mock oficial.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

describe('isVisionModelId', () => {
  it('acepta un id no vacío y rechaza lo demás', () => {
    expect(isVisionModelId('gemini-3.6-flash')).toBe(true);
    expect(isVisionModelId('')).toBe(false);
    expect(isVisionModelId(null)).toBe(false);
    expect(isVisionModelId(42)).toBe(false);
  });
});

describe('load/saveVisionModelPreference', () => {
  it('devuelve null con el storage vacío', async () => {
    expect(await loadVisionModelPreference()).toBeNull();
  });

  it('devuelve lo guardado', async () => {
    await saveVisionModelPreference('claude-haiku-4-5');
    expect(await loadVisionModelPreference()).toBe('claude-haiku-4-5');
  });

  it('devuelve null si el storage tira, en vez de romper', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disco lleno'));
    expect(await loadVisionModelPreference()).toBeNull();
  });

  it('un fallo de escritura no tira', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disco lleno'));
    await expect(saveVisionModelPreference('x')).resolves.toBeUndefined();
    expect(VISION_MODEL_PREFERENCE_KEY).toBe('virovision.visionModel');
  });
});
