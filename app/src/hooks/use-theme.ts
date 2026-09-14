/**
 * Returns the colour tokens of the app's scheme.
 *
 * There is a single scheme since 2026-09-14 (ADR 0010): the app ships dark only. The theme selector
 * (system / light / dark) was a setting nobody who uses this app by voice would reach for, and it
 * cost a stored preference, a splash held until it was read, and a second styling path to keep in
 * sync. The light palette still exists in `colors.js` as the brand's reference and stays verified by
 * `theme.test.ts`; nothing in the app renders it.
 */
import { Colors } from '@/constants/theme';

export function useTheme() {
  return Colors.dark;
}
