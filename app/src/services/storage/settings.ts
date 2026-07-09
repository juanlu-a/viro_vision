/**
 * Persistent user settings (speech rate, verbosity, last device, etc.).
 *
 * STATUS: in-memory stub. Swap for a real backend (`expo-secure-store` or
 * `@react-native-async-storage/async-storage`) when settings need to survive app restarts.
 */
export interface AppSettings {
  /** Whether to also mention non-primary detections when announcing. */
  mentionOtherDetections: boolean;
  /** Speech rate multiplier (1 = normal). */
  speechRate: number;
}

export const defaultSettings: AppSettings = {
  mentionOtherDetections: false,
  speechRate: 1,
};

let current: AppSettings = { ...defaultSettings };

export async function loadSettings(): Promise<AppSettings> {
  return current;
}

export async function saveSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  current = { ...current, ...next };
  return current;
}
