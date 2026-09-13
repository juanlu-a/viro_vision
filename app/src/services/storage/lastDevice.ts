/**
 * The identifier of the last device we connected to.
 *
 * It exists to skip the scan. A scan is the slowest and least reliable way to find a peripheral we
 * have already met: it takes seconds, it depends on catching an advertisement packet in the air, and
 * on iOS it **cannot** see a peripheral that is already connected to the system. Connecting straight
 * to a known identifier goes through none of that.
 *
 * On iOS the identifier is a UUID the system assigns per app install (not the device's MAC, which
 * iOS never exposes), so it survives app restarts and is meaningless to anyone else — which is why
 * it can sit in AsyncStorage next to the theme preference and not in the keychain. On Android it is
 * the MAC. Either way it is only ever a hint: everything that reads it falls back to the scan.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LAST_DEVICE_KEY = 'virovision.lastDeviceId';

/** The remembered identifier, or null if there is none (or storage is unavailable). */
export async function loadLastDeviceId(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_DEVICE_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/** Remembers the identifier. A write failure costs a scan next time, never a connection. */
export async function saveLastDeviceId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_DEVICE_KEY, id);
  } catch {
    /* the scan is the fallback: this is a shortcut, not a dependency */
  }
}
