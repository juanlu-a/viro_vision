import type { ThemeColor } from './theme';

/** Types for the colour table. The value lives in `colors.js`, shared with Tailwind. */
export declare const Colors: {
  readonly dark: Readonly<Record<ThemeColor, string>>;
  readonly light: Readonly<Record<ThemeColor, string>>;
};
