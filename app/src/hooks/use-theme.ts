/**
 * Returns the colour tokens of the effective scheme.
 *
 * "Effective" = what the user chose in Settings, already resolved against the system when the
 * preference is `system`. See ThemePreferenceProvider.
 */
import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';

export function useTheme() {
  const { scheme } = useThemePreference();
  return Colors[scheme];
}
