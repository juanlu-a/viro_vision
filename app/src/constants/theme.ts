/**
 * ViroVision design system — tokens.
 *
 * Source: `docs/brand/virovision-marca.md` (manual v1.0). The manual defines both modes by name and
 * hex, and here they are followed **to the letter** except where stated otherwise:
 *
 *   light  background `#F4F6F8` · text `#061D3A` / `#33475E` · accent `#1FB57A` · 2nd `#1256D4`
 *   dark   background `#061D3A` · surface `#0E2B4F` · text `#E8EFF7` / `#9FB8D4` · accent `#2BD69A`
 *
 * Two rules from the manual override everything else:
 *
 *   1. **Green is the primary**: buttons, focus and confirmed state. Blue is secondary — surfaces,
 *      links and data. Target proportion: 70 % neutrals, 20 % green, 10 % blue.
 *   2. **The accent targets 4.5:1**, not 7:1. That is why `#1FB57A` goes as a *fill* with `#061D3A`
 *      text on top (6.39:1) and never as a text colour: on the light background it gives 2.44:1.
 *
 * Hence the role split that can be surprising: `primary` is a **fill** colour and `success` a
 * **text** colour. In dark they coincide (`#2BD69A` gives 8.99:1 and works for both); in light they
 * cannot, because no green satisfies both roles at once.
 *
 * Target: **AAA (7:1)** for text, 4.5:1 for the accent, 3:1 for control borders (WCAG 1.4.11).
 * `theme.test.ts` verifies it automatically.
 */
// The table lives in `colors.js`, in plain JavaScript, because `tailwind.config.js` needs it too and
// is CommonJS. A single source: `bg-surface` and this token are the same hex, and `theme.test.ts`
// checks the one the app actually uses.
export { Colors } from './colors';


/**
 * The system's colour roles. They are listed by hand because the table now lives in plain JavaScript
 * and cannot type itself — in exchange, this list is the contract Tailwind and the app share, and
 * adding a token without naming it here is a compile error.
 */
export type ThemeColor =
  | 'background'
  | 'surface'
  | 'surfaceElevated'
  | 'border'
  | 'borderStrong'
  | 'text'
  | 'textSecondary'
  | 'primary'
  | 'primaryMuted'
  | 'primaryEdge'
  | 'onPrimary'
  | 'danger'
  | 'success'
  | 'successMuted'
  | 'tabInactive'
  | 'overlay';
/**
 * Any theme. Deliberately `string` and not one concrete theme's literals: otherwise the dark theme
 * would not be assignable to `Theme` and nothing could treat them interchangeably.
 */
export type Theme = Record<ThemeColor, string>;

/**
 * The brand's type families (manual, section 04). They are embedded in the binary with `app.json`'s
 * `expo-font` plugin, not loaded at runtime: a font swap mid-startup is a layout jump, and in an app
 * for low vision that disorients more than in any other.
 *
 * The names are the files' PostScript names, which is what iOS demands. Android takes the file name
 * unless it is declared, so in `app.json` they are declared **identical**: a single `fontFamily`
 * string works on both platforms and there is no per-system path.
 *
 * `fontWeight` is NOT combined with these families: each weight is its own file, and additionally
 * asking the system for a weight triggers synthetic bold (Android) or is ignored (iOS).
 */
export const Fonts = {
  /** Titles. The manual asks for −2 % tracking, applied in `themed-text`. */
  display: 'SpaceGrotesk-Bold',
  sans: 'IBMPlexSans-Regular',
  sansBold: 'IBMPlexSans-SemiBold',
  /** Data: line numbers, latencies, identifiers. */
  mono: 'IBMPlexMono-Regular',
} as const;

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
