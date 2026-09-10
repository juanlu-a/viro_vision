/**
 * Tailwind for React Native, via NativeWind (the path Expo SDK 57 documents).
 *
 * The colours are **not defined here**: each role points at a CSS variable that `src/global.css`
 * defines, and that file is generated from `src/constants/colors.js` —the single source of truth,
 * the same one `constants/theme.ts` consumes and `theme.test.ts` verifies. Duplicating them would
 * make `bg-surface` and the theme token drift apart without anyone noticing.
 *
 * The classes are **semantic, not chromatic**: `bg-surface`, not `bg-blue-900`. A role name survives
 * a rebrand; a colour name does not. It is the same reason the tokens are called `primary` and not
 * `green`.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // `class` and not `media`: the app's theme is a persisted user preference, not the system's
  // scheme. `ThemePreferenceProvider` is what pushes it.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Each role points at a CSS variable, not at a hex. That way `bg-surface` is written
        // **once** and holds in both themes: what changes is the variable's value, which
        // `global.css` defines for `:root` and for `.dark:root`. That file is generated from
        // `colors.js` with `npm run theme:css`, so there is still a single source of truth.
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
        // The same steps as `Spacing` in theme.ts, so `p-4` and `Spacing.four` do not disagree.
        half: 2,
        one: 4,
        two: 8,
        three: 16,
        four: 24,
        five: 32,
        six: 64,
      },
      borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
      // The brand families, embedded by the `expo-font` plugin. The names are each file's
      // PostScript name: every weight is a different family, so they are NOT combined with
      // `font-bold` —that would trigger synthetic bold on Android. You change family, not weight.
      fontFamily: {
        display: ['SpaceGrotesk-Bold'],
        sans: ['IBMPlexSans-Regular'],
        'sans-bold': ['IBMPlexSans-SemiBold'],
        mono: ['IBMPlexMono-Regular'],
      },
      // The manual's type scale: a 17 px floor for text. The pair is [size, line height].
      fontSize: {
        small: ['17px', '24px'],
        base: ['18px', '27px'],
        code: ['15px', '22px'],
        subtitle: ['28px', '36px'],
        title: ['40px', '46px'],
      },
      letterSpacing: {
        // The −2 % tracking the manual asks for on titles in Space Grotesk Bold.
        title: '-0.8px',
        subtitle: '-0.56px',
      },
      minHeight: {
        // Minimum touch target (WCAG / platforms). The same as `A11y.minTouchTarget`.
        touch: '48px',
        button: '52px',
      },
      maxWidth: {
        // The same as `MaxContentWidth`: wider than this, text becomes uncomfortable to read.
        content: '640px',
      },
    },
  },
  plugins: [],
};
