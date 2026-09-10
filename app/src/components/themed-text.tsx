/**
 * The app's text, with the brand typography (manual, section 04).
 *
 * Each variant sets a **family** and not a weight: the weights are separate files and additionally
 * asking for a `font-bold` produces synthetic bold on Android. You change family, not weight.
 *
 * The manual asks for **17 px minimum** for text, and it is honoured even in the small labels: the
 * size floor is what shows the most in low vision.
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

/** The colour roles, as classes. Tailwind needs the full name so it does not purge them. */
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
