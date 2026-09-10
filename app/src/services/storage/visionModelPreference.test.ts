/**
 * Exists because storage can fail or bring back garbage (an old version, a corrupt key) and
 * supermarket mode cannot break over it: on any problem null is returned and the resolver falls back
 * to the default. The first test in this codebase to touch AsyncStorage: it uses the package's
 * official mock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  VISION_MODEL_PREFERENCE_KEY,
  isVisionModelId,
  loadVisionModelPreference,
  saveVisionModelPreference,
} from './visionModelPreference';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock's factory runs before the imports; require is the documented form of the official mock.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

describe('isVisionModelId', () => {
  it('accepts a non-empty id and rejects the rest', () => {
    expect(isVisionModelId('gemini-3.6-flash')).toBe(true);
    expect(isVisionModelId('')).toBe(false);
    expect(isVisionModelId(null)).toBe(false);
    expect(isVisionModelId(42)).toBe(false);
  });
});

describe('load/saveVisionModelPreference', () => {
  it('returns null with empty storage', async () => {
    expect(await loadVisionModelPreference()).toBeNull();
  });

  it('returns what was stored', async () => {
    await saveVisionModelPreference('claude-haiku-4-5');
    expect(await loadVisionModelPreference()).toBe('claude-haiku-4-5');
  });

  it('returns null when storage throws, instead of breaking', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk full'));
    expect(await loadVisionModelPreference()).toBeNull();
  });

  it('a write failure does not throw', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveVisionModelPreference('x')).resolves.toBeUndefined();
    expect(VISION_MODEL_PREFERENCE_KEY).toBe('virovision.visionModel');
  });
});
