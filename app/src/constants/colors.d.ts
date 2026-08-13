import type { ThemeColor } from './theme';

/** Tipos de la tabla de colores. El valor vive en `colors.js`, compartido con Tailwind. */
export declare const Colors: {
  readonly dark: Readonly<Record<ThemeColor, string>>;
  readonly light: Readonly<Record<ThemeColor, string>>;
};
