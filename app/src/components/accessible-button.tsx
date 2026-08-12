/**
 * Large, high-contrast, screen-reader-friendly button built from the standard RN `Pressable`.
 *
 * Standard native component (Mascetti et al. strategy) with an explicit accessibility role, label and
 * hint, a ≥48dp target, theme-aware colors, and subtle haptic feedback (useful non-visual signal).
 */
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type AccessibleButtonProps = {
  label: string;
  onPress: () => void;
  hint?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
};

export function AccessibleButton({
  label,
  onPress,
  hint,
  variant = 'primary',
  disabled = false,
  loading = false,
}: AccessibleButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary' ? theme.primary : variant === 'danger' ? theme.danger : 'transparent';
  // El primario va contorneado: en tema claro el verde de marca da 2.44:1 contra el fondo, y el
  // *límite* de un control necesita 3:1 (WCAG 1.4.11). El borde lo aporta sin tocar el relleno.
  const borderColor =
    variant === 'primary'
      ? theme.primaryEdge
      : variant === 'secondary'
        ? theme.borderStrong
        : 'transparent';
  const labelColor =
    variant === 'primary' || variant === 'danger'
      ? theme.onPrimary
      : variant === 'ghost'
        ? // `primary` acá sería texto verde de marca: 2.44:1 en claro. `success` es el mismo verde
          // llevado hasta AAA, que es lo que un rótulo necesita.
          theme.success
        : theme.text;

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'primary' || variant === 'secondary' ? 1.5 : 0,
        },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text
          style={[styles.label, { color: labelColor }]}
            accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 17,
    fontFamily: Fonts.sansBold,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
