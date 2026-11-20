/**
 * The device network this phone has already joined (its SSID).
 *
 * It exists because of the iOS prompt (2026-11-20). `NEHotspotConfigurationManager` asks "¿Querés
 * unirte a ViroVision?" every time it is called while the phone is not on that network, even when
 * the configuration is already saved (`services/wifi/join.ts`). Once the phone has joined once, the
 * network is saved and iOS rejoins it on its own when it can, so the app stops asking the system on
 * every connection and only waits. The prompt is left for when a reading actually needs the photo
 * and the phone still is not there.
 *
 * Only a hint, like `lastDevice`: losing it costs one prompt, never a connection.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const JOINED_NETWORK_KEY = 'virovision.joinedNetwork';

export async function loadJoinedNetwork(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(JOINED_NETWORK_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

export async function saveJoinedNetwork(ssid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(JOINED_NETWORK_KEY, ssid);
  } catch {
    /* a prompt next time is the cost, nothing else */
  }
}
