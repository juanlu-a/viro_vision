/**
 * Vista con fondo del tema. Por defecto el fondo de pantalla.
 */
import { View, type ViewProps } from 'react-native';

const BACKGROUNDS = {
  background: 'bg-background',
  surface: 'bg-surface',
  surfaceElevated: 'bg-surface-elevated',
} as const;

export type ThemedViewProps = ViewProps & {
  type?: keyof typeof BACKGROUNDS;
  className?: string;
};

export function ThemedView({ className, type = 'background', ...rest }: ThemedViewProps) {
  return <View className={`${BACKGROUNDS[type]} ${className ?? ''}`} {...rest} />;
}
