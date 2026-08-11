/**
 * ViroVision design system — tokens.
 *
 * Identidad de marca (ver `docs/brand/virovision-marca.md`): azul profundo, azul sensor y verde
 * lectura. **Los tokens NO son los hex del manual tal cual**, y eso es deliberado:
 *
 *   - Azul Sensor `#1256D4` sobre Azul Profundo da **2.66:1** — falla WCAG por lejos.
 *   - Verde Lectura `#1FB57A` sobre Gris Niebla da **2.44:1** — también falla.
 *   - Blanco sobre Verde Lectura (botón) da **2.64:1** — falla.
 *
 * No es un error del manual: un logo no es texto, y WCAG no le exige contraste a un símbolo. Pero
 * usar esos hex como color de texto o de relleno degradaría la accesibilidad — en una app para
 * personas con baja visión eso no es aceptable. Así que los tokens **conservan el tono de la marca
 * y ajustan la luminosidad** hasta alcanzar el contraste.
 *
 * Objetivo: **AAA (7:1)** para texto, AA (4.5:1) como piso. `theme.test.ts` lo verifica
 * automáticamente — si alguien "corrige" un token para que coincida con el manual, el test falla.
 */
import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  dark: {
    background: '#061D3A', // Azul Profundo — el fondo del ícono de la app
    // Superficies apenas despegadas del fondo: casi todo el contenido vive en tarjetas, así que
    // si son muy claras el azul que domina la pantalla deja de ser el Azul Profundo de la marca.
    surface: '#0A2B54',
    surfaceElevated: '#0D3567',
    border: '#123F76', // decorativo (tarjetas): no necesita 3:1
    borderStrong: '#1C6AC4', // borde de controles (campos, foco): 3:1 — WCAG 1.4.11
    text: '#F4F6F8', // Gris Niebla — 12.31:1 AAA
    textSecondary: '#A9C0DE', // 7.4:1 AAA
    primary: '#2BD69A', // Verde claro de marca — 7.11:1 AAA
    primaryMuted: '#0B3350',
    onPrimary: '#061D3A', // texto OSCURO sobre relleno claro: 8.99:1. Blanco sobre verde falla.
    danger: '#F3AAAD', // 7.09:1 AAA
    success: '#2BD69A',
    tabInactive: '#A9C0DE',
  },
  light: {
    background: '#F4F6F8', // Gris Niebla
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#CFD7E0', // decorativo (tarjetas): no necesita 3:1
    borderStrong: '#7990A9', // borde de controles (campos, foco): 3.04:1 — WCAG 1.4.11
    text: '#061D3A', // Azul Profundo — 15.57:1 AAA
    textSecondary: '#3D5273', // 7.6:1 AAA
    // Verde, igual que en el tema oscuro. El manual pone al Azul Sensor como "acción primaria",
    // pero ese azul falla contraste sobre fondo oscuro, así que ahí el acento tiene que ser verde
    // — y un acento que cambia de color entre temas es peor que apartarse del rol del manual.
    // Verde Lectura oscurecido hasta AAA: 7.19:1 sobre el fondo.
    primary: '#105E3F',
    primaryMuted: '#E3F3EC',
    onPrimary: '#FFFFFF', // 7.79:1 sobre el primario
    danger: '#A5171C', // 7.08:1 AAA
    success: '#105E3F', // Verde Lectura oscurecido hasta AAA — 7.19:1
    tabInactive: '#3D5273',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
/**
 * Un tema cualquiera. Deliberadamente `string` y no los literales de un tema concreto: si no,
 * el tema oscuro no sería asignable a `Theme` y nada podría tratarlos de forma intercambiable.
 */
export type Theme = Record<ThemeColor, string>;

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
