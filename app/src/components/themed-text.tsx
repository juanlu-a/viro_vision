/**
 * Texto de la app, con la tipografía de la marca (manual, sección 04).
 *
 * Cada variante fija **familia** y no peso: los pesos son archivos distintos y pedir además un
 * `font-bold` produce negrita sintética en Android. Se cambia de familia, no de peso.
 *
 * El manual pide **17 px como mínimo** para texto, y se respeta incluso en los rótulos chicos: el
 * piso de tamaño es lo que más se nota en baja visión.
 */
import { Text, type TextProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
  className?: string;
};

const VARIANTS: Record<ThemedTextType, string> = {
  default: 'font-sans text-base',
  title: 'font-display text-title tracking-title',
  subtitle: 'font-display text-subtitle tracking-subtitle',
  small: 'font-sans text-small',
  smallBold: 'font-sans-bold text-small',
  link: 'font-sans text-small leading-7',
  linkPrimary: 'font-sans-bold text-small leading-7',
  code: 'font-mono text-code',
};

/** Los roles de color, como clases. Tailwind necesita el nombre completo para no purgarlo. */
const COLORS: Record<ThemeColor, string> = {
  background: 'text-background',
  surface: 'text-surface',
  surfaceElevated: 'text-surface-elevated',
  border: 'text-border',
  borderStrong: 'text-border-strong',
  text: 'text-text',
  textSecondary: 'text-text-secondary',
  primary: 'text-primary',
  primaryMuted: 'text-primary-muted',
  primaryEdge: 'text-primary-edge',
  onPrimary: 'text-on-primary',
  danger: 'text-danger',
  success: 'text-success',
  successMuted: 'text-success-muted',
  tabInactive: 'text-tab-inactive',
  overlay: 'text-text',
};

export function ThemedText({
  className,
  type = 'default',
  themeColor = 'text',
  ...rest
}: ThemedTextProps) {
  return (
    <Text className={`${VARIANTS[type]} ${COLORS[themeColor]} ${className ?? ''}`} {...rest} />
  );
}
