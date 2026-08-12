/**
 * Tailwind para React Native, vía NativeWind (el camino que documenta Expo SDK 57).
 *
 * Los colores **no se definen acá**: cada rol apunta a una variable CSS que `src/global.css`
 * define, y ese archivo se genera desde `src/constants/colors.js` —la única fuente de verdad, la
 * misma que consume `constants/theme.ts` y que verifica `theme.test.ts`—. Duplicarlos haría que
 * `bg-surface` y el token del tema se separaran sin que nadie lo note.
 *
 * Las clases son **semánticas, no cromáticas**: `bg-surface`, no `bg-blue-900`. Un nombre de rol
 * sobrevive a un cambio de marca; un nombre de color, no. Es la misma razón por la que los tokens
 * se llaman `primary` y no `verde`.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // `class` y no `media`: el tema de la app es una preferencia del usuario que se persiste, no el
  // esquema del sistema. `ThemePreferenceProvider` es quien lo empuja.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cada rol apunta a una variable CSS, no a un hex. Así `bg-surface` se escribe **una vez**
        // y vale en los dos temas: lo que cambia es el valor de la variable, que `global.css`
        // define para `:root` y para `.dark:root`. Ese archivo se genera desde `colors.js` con
        // `npm run theme:css`, así que sigue habiendo una sola fuente de verdad.
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-muted': 'rgb(var(--color-primary-muted) / <alpha-value>)',
        'primary-edge': 'rgb(var(--color-primary-edge) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-muted': 'rgb(var(--color-success-muted) / <alpha-value>)',
        'tab-inactive': 'rgb(var(--color-tab-inactive) / <alpha-value>)',
      },
      spacing: {
        // Mismos pasos que `Spacing` en theme.ts, para que `p-4` y `Spacing.four` no discrepen.
        half: 2,
        one: 4,
        two: 8,
        three: 16,
        four: 24,
        five: 32,
        six: 64,
      },
      borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
    },
  },
  plugins: [],
};
