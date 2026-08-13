/**
 * Campo de texto etiquetado y accesible: etiqueta visible + pista, objetivo generoso, y un estado
 * de error que se anuncia. Sobre el `TextInput` estándar de RN.
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
  // `placeholderTextColor` es una prop, no un estilo: NativeWind no la alcanza.
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Sólo el borde depende del estado; el resto de la caja es siempre igual.
  const borde = error ? 'border-danger' : focused ? 'border-primary' : 'border-border-strong';

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
        className={`min-h-touch rounded-md border-[1.5px] px-three py-two font-sans text-small text-text ${borde} ${className ?? ''}`}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="font-sans text-small text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
