/**
 * A large, high-contrast, screen-reader-friendly button built from the standard RN `Pressable`.
 *
 * Uses a standard native component (per the Mascetti et al. 2020 strategy: standard components
 * inherit correct VoiceOver/TalkBack behavior) and always sets an explicit accessibility role,
 * label and (optional) hint. Enforces the minimum touch-target size for low-vision users.
 */
import { Pressable, StyleSheet } from 'react-native';

import { A11y, Brand, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type AccessibleButtonProps = {
  label: string;
  onPress: () => void;
  /** Extra context announced by the screen reader about what happens on activation. */
  hint?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function AccessibleButton({
  label,
  onPress,
  hint,
  variant = 'primary',
  disabled = false,
}: AccessibleButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText
        type="default"
        style={[styles.label, isPrimary && styles.labelPrimary]}
        // The Pressable is the accessible element; hide the inner text from the reader.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: A11y.minTouchTarget,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Brand.primary,
  },
  secondary: {
    borderWidth: 2,
    borderColor: Brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
  },
  labelPrimary: {
    color: Brand.onPrimary,
  },
});
