/**
 * ViroVision design system — tokens.
 *
 * Fuente: `docs/brand/virovision-marca.md` (manual v1.0). El manual define los dos modos con
 * nombre y hex, y acá se siguen **al pie de la letra** salvo donde se aclara lo contrario:
 *
 *   claro   fondo `#F4F6F8` · texto `#061D3A` / `#33475E` · acento `#1FB57A` · 2.º `#1256D4`
 *   oscuro  fondo `#061D3A` · superficie `#0E2B4F` · texto `#E8EFF7` / `#9FB8D4` · acento `#2BD69A`
 *
 * Dos reglas del manual mandan sobre todo lo demás:
 *
 *   1. **El verde es el primario**: botones, foco y estado confirmado. El azul es secundario —
 *      superficies, enlaces y datos. Proporción buscada: 70 % neutros, 20 % verde, 10 % azul.
 *   2. **El acento apunta a 4.5:1**, no a 7:1. Por eso `#1FB57A` va como *relleno* con texto
 *      `#061D3A` encima (6.39:1) y nunca como color de texto: sobre el fondo claro da 2.44:1.
 *
 * De ahí la separación de roles que puede sorprender: `primary` es un color de **relleno** y
 * `success` un color de **texto**. En oscuro coinciden (`#2BD69A` da 8.99:1 y sirve para las dos
 * cosas); en claro no pueden coincidir, porque ningún verde cumple los dos roles a la vez.
 *
 * Objetivo: **AAA (7:1)** para texto, 4.5:1 para el acento, 3:1 para bordes de control
 * (WCAG 1.4.11). `theme.test.ts` lo verifica automáticamente.
 */
// La tabla vive en `colors.js`, en JavaScript plano, porque `tailwind.config.js` también la
// necesita y es CommonJS. Una sola fuente: `bg-surface` y este token son el mismo hex, y
// `theme.test.ts` verifica el que la app realmente usa.
export { Colors } from './colors';


/**
 * Los roles de color del sistema. Se enumeran a mano porque la tabla ahora vive en JavaScript
 * plano y no puede tiparse sola — a cambio, esta lista es el contrato que Tailwind y la app
 * comparten, y agregar un token sin nombrarlo acá da error de compilación.
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
 * Un tema cualquiera. Deliberadamente `string` y no los literales de un tema concreto: si no,
 * el tema oscuro no sería asignable a `Theme` y nada podría tratarlos de forma intercambiable.
 */
export type Theme = Record<ThemeColor, string>;

/**
 * Familias tipográficas de la marca (manual, sección 04). Se embeben en el binario con el plugin
 * `expo-font` de `app.json`, no se cargan en runtime: un cambio de fuente a mitad del arranque es
 * un salto de layout, y en una app para baja visión eso desorienta más que en cualquier otra.
 *
 * Los nombres son los PostScript names de los archivos, que es lo que iOS exige. Android toma el
 * nombre del archivo salvo que se declare, así que en `app.json` se declaran **iguales**: un solo
 * string de `fontFamily` sirve en las dos plataformas y no hay un camino por sistema.
 *
 * `fontWeight` NO se combina con estas familias: cada peso es un archivo propio, y pedirle además
 * un peso al sistema dispara negrita sintética (Android) o lo ignora (iOS).
 */
export const Fonts = {
  /** Títulos. El manual pide tracking −2 %, aplicado en `themed-text`. */
  display: 'SpaceGrotesk-Bold',
  sans: 'IBMPlexSans-Regular',
  sansBold: 'IBMPlexSans-SemiBold',
  /** Datos: números de línea, latencias, identificadores. */
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
