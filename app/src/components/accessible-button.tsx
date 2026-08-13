/**
 * Botón grande, de alto contraste y amable con el lector de pantalla, sobre el `Pressable` de RN.
 *
 * Componente nativo estándar (estrategia de Mascetti et al.) con rol, etiqueta y pista explícitos,
 * objetivo ≥48 dp, colores del tema y una vibración sutil — que es una señal no visual útil.
 *
 * El primario va **contorneado**: en tema claro el verde de marca da 2.44:1 contra el fondo, y el
 * *límite* de un control necesita 3:1 (WCAG 1.4.11). El borde lo aporta sin tocar el relleno.
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

const CAJA: Record<ButtonVariant, string> = {
  primary: 'bg-primary border-[1.5px] border-primary-edge',
  secondary: 'border-[1.5px] border-border-strong',
  ghost: '',
  danger: 'bg-danger',
};

const ROTULO: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-text',
  // `primary` acá sería texto verde de marca: 2.44:1 en claro. `success` es el mismo verde llevado
  // hasta AAA, que es lo que un rótulo necesita.
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
        CAJA[variant]
      } ${isDisabled ? 'opacity-40' : ''}`}>
      {loading ? (
        // El color del indicador es una prop, no un estilo: NativeWind no lo alcanza.
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary : theme.text} />
      ) : (
        <Text
          className={`text-center font-sans-bold text-small tracking-[0.2px] ${ROTULO[variant]}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {label}
        </Text>
      )}
    </Pressable>
  );
}
