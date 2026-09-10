/**
 * A labelled, accessible text field: visible label + hint, a generous target, and an error state
 * that gets announced. On top of RN's standard `TextInput`.
 */
import { useState } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  // `placeholderTextColor` is a prop, not a style: NativeWind does not reach it.
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Only the border depends on state; the rest of the box is always the same.
  const border = error ? 'border-danger' : focused ? 'border-primary' : 'border-border-strong';

  return (
    <View className="gap-one">
      <Text className="font-sans-bold text-small text-text-secondary">{label}</Text>
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.textSecondary}
        className={`min-h-touch rounded-md border-[1.5px] px-three py-two font-sans text-small text-text ${border} ${className ?? ''}`}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-small text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
