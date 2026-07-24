/**
 * ViroVision design system — tokens.
 *
 * Identity: green + black (dark, default) with a clean white light mode. Minimalist, high-contrast,
 * accessibility-first (WCAG AA). Semantic color names so screens never hardcode hex values.
 */
import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  dark: {
    background: '#000000',
    surface: '#141414',
    surfaceElevated: '#1F1F1F',
    border: '#2E2E2E',
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    primary: '#22C55E', // green-500 — bright green on black (high contrast)
    primaryMuted: '#16351F', // subtle green tint for backgrounds
    onPrimary: '#04140A', // near-black text on green
    danger: '#F87171',
    success: '#22C55E',
    tabInactive: '#71717A',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F6F7F6',
    surfaceElevated: '#FFFFFF',
    border: '#E4E4E7',
    text: '#0A0A0A',
    textSecondary: '#52525B',
    primary: '#15803D', // green-700 — AA contrast on white
    primaryMuted: '#E7F6EC',
    onPrimary: '#FFFFFF',
    danger: '#DC2626',
    success: '#15803D',
    tabInactive: '#8E8E93',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = (typeof Colors)['light'];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const MaxContentWidth = 640;

/**
 * Accessibility tokens. ViroVision targets low/no-vision users, so touch targets and type stay
 * generous. 48dp is the WCAG / platform-recommended minimum target size.
 */
export const A11y = {
  minTouchTarget: 48,
  focusRingWidth: 3,
} as const;
