import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  APP_MODE_PREFERENCE_KEY,
  loadAppModePreference,
  parseAppMode,
  saveAppModePreference,
} from './appModePreference';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock's factory runs before the imports; require is the documented form of the official mock.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

describe('parseAppMode', () => {
  it('only reads development when it is exactly that', () => {
    expect(parseAppMode('development')).toBe('development');
    expect(parseAppMode('product')).toBe('product');
    expect(parseAppMode('Development')).toBe('product');
    expect(parseAppMode(null)).toBe('product');
    expect(parseAppMode(1)).toBe('product');
  });
});

describe('app mode preference', () => {
  it('starts in product mode with nothing stored', async () => {
    await expect(loadAppModePreference()).resolves.toBe('product');
  });

  it('round-trips the chosen mode', async () => {
    await saveAppModePreference('development');
    expect(await AsyncStorage.getItem(APP_MODE_PREFERENCE_KEY)).toBe('development');
    await expect(loadAppModePreference()).resolves.toBe('development');
  });

  it('falls back to product mode when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(loadAppModePreference()).resolves.toBe('product');
  });
});
