import AsyncStorage from '@react-native-async-storage/async-storage';

import { JOINED_NETWORK_KEY, loadJoinedNetwork, saveJoinedNetwork } from './joinedNetwork';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock's factory runs before the imports; require is the documented form of the official mock.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

describe('joined network', () => {
  it('is null until the phone has joined once, so the first pairing may prompt', async () => {
    await expect(loadJoinedNetwork()).resolves.toBeNull();
  });

  it('remembers the SSID joined, which is what spares the prompt on the next power-on', async () => {
    await saveJoinedNetwork('ViroVision');
    await expect(loadJoinedNetwork()).resolves.toBe('ViroVision');
    expect(await AsyncStorage.getItem(JOINED_NETWORK_KEY)).toBe('ViroVision');
  });

  it('treats a storage failure as "never joined" instead of throwing', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(loadJoinedNetwork()).resolves.toBeNull();
  });
});
