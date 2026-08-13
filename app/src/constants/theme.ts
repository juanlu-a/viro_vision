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
export const Colors = {
  dark: {
    background: '#061D3A', // Azul Profundo — el fondo del ícono de la app
    // Superficies apenas despegadas del fondo: casi todo el contenido vive en tarjetas, así que
    // si son muy claras el azul que domina la pantalla deja de ser el Azul Profundo de la marca.
    surface: '#0E2B4F', // del manual (sección modo claro/oscuro)
    surfaceElevated: '#0D3567',
    border: '#123F76', // decorativo (tarjetas): no necesita 3:1
    borderStrong: '#4D9BFF', // azul secundario del manual — 5.98:1 sobre el fondo, 5.04:1 sobre la tarjeta
    text: '#E8EFF7', // del manual — 14.56:1 sobre fondo, 12.27:1 sobre superficie (AAA)
    textSecondary: '#9FB8D4', // del manual — 8.26:1 sobre fondo (AAA)
    // Verde Lectura, variante del manual para fondo oscuro: 8.99:1 sobre el fondo (AAA). Acá sí
    // sirve como relleno y como texto, así que `primary` y `success` son el mismo color.
    primary: '#2BD69A',
    primaryMuted: '#0B3A33',
    // Texto OSCURO sobre el relleno verde: 8.99:1. Blanco encima daría 1.88:1 y fallaría.
    onPrimary: '#061D3A',
    // Acá el relleno ya se distingue solo (8.99:1), así que el borde es del mismo color: existe
    // para que el componente tenga la misma forma en los dos temas, no para agregar contraste.
    primaryEdge: '#2BD69A',
    danger: '#F3AAAD', // 7.09:1 AAA
    success: '#2BD69A', // Verde Lectura del manual — 8.99:1 AAA
    successMuted: '#0B3A33',
    tabInactive: '#A9C0DE',
    // Velo de los modales. Más opaco en oscuro: sobre un fondo ya oscuro, un velo suave no
    // separa lo suficiente el contenido de arriba del de atrás.
    overlay: 'rgba(2, 10, 22, 0.72)',
  },
  light: {
    background: '#F4F6F8', // Gris Niebla — del manual
    // Única desviación del manual, que pide superficie blanca: las tarjetas llevan un velo del
    // Azul Sensor. Con superficies blancas sobre Gris Niebla el azul de la marca no aparecía por
    // ningún lado en modo claro, y el manual le reserva justamente el rol de "superficie".
    surface: '#E4EDFB', // 12 % de #1256D4 sobre blanco
    // Blanco para lo que va *encima* de una tarjeta: separa por luminosidad, no sólo por borde.
    surfaceElevated: '#FFFFFF',
    border: '#BFD2F5', // decorativo (tarjetas): no necesita 3:1
    borderStrong: '#5B7FB9', // controles: 3.74:1 sobre el fondo, 3.44:1 sobre la tarjeta
    text: '#061D3A', // del manual — 15.57:1 AAA
    textSecondary: '#33475E', // del manual — 8.80:1 AAA
    // Verde Lectura tal cual el manual. Es un RELLENO: 2.44:1 como texto sobre el fondo, pero
    // 6.39:1 con el texto azul profundo encima, que es exactamente el botón que dibuja el manual.
    primary: '#1FB57A',
    primaryMuted: '#DFF5EB',
    onPrimary: '#061D3A', // del manual — 6.39:1 sobre el verde
    // El relleno verde sobre el fondo claro da 2.44:1: por debajo del 3:1 que WCAG 1.4.11 le pide
    // al **límite** de un control. Se resuelve como corresponde —contorneándolo— y no aclarando el
    // fondo ni oscureciendo la marca: el borde da 7.19:1 y el botón sigue siendo verde de marca.
    primaryEdge: '#105E3F',
    danger: '#A5171C', // 7.08:1 AAA
    // El mismo verde no sirve como TEXTO en claro (2.44:1). Se oscurece hasta AAA conservando el
    // tono: es el color de los rótulos de estado ("Conectado", "confirmado"), no de los rellenos.
    success: '#105E3F', // 7.19:1 sobre el fondo, 6.61:1 sobre la tarjeta
    successMuted: '#DFF5EB',
    tabInactive: '#3D5273',
    overlay: 'rgba(6, 29, 58, 0.45)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
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
