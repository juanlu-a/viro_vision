/**
 * A large, high-contrast, screen-reader-friendly button, on top of RN's `Pressable`.
 *
 * A standard native component (Mascetti et al.'s strategy) with explicit role, label and hint, a
 * ≥48 dp target, theme colours and a subtle vibration — which is a useful non-visual signal.
 *
 * The primary one is **outlined**: in the light theme the brand green gives 2.44:1 against the
 * background, and a control's *boundary* needs 3:1 (WCAG 1.4.11). The border provides it without
 * touching the fill.
 */
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, Text } from 'react-native';

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

const BOX: Record<ButtonVariant, string> = {
  primary: 'bg-primary border-[1.5px] border-primary-edge',
  secondary: 'border-[1.5px] border-border-strong',
  ghost: '',
  danger: 'bg-danger',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-text',
  // `primary` here would be brand-green text: 2.44:1 in light. `success` is the same green taken up
  // to AAA, which is what a label needs.
  ghost: 'text-success',
  danger: 'text-on-primary',
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
      className={`min-h-button items-center justify-center rounded-md px-four py-three active:opacity-75 ${
        BOX[variant]
      } ${isDisabled ? 'opacity-40' : ''}`}>
      {loading ? (
        // The indicator's colour is a prop, not a style: NativeWind does not reach it.
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary : theme.text} />
      ) : (
        <Text
          className={`text-center font-sans-bold text-small tracking-[0.2px] ${LABEL[variant]}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {label}
        </Text>
      )}
    </Pressable>
  );
}
