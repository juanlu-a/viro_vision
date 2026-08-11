/**
 * Devuelve los tokens de color del esquema efectivo.
 *
 * "Efectivo" = lo que el usuario eligió en Ajustes, ya resuelto contra el sistema cuando la
 * preferencia es `system`. Ver ThemePreferenceProvider.
 */
import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';

export function useTheme() {
  const { scheme } = useThemePreference();
  return Colors[scheme];
}
