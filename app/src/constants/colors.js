/**
 * The brand's colour table. **The single source of truth**, in plain JavaScript on purpose.
 *
 * Two worlds consume it that cannot share a TypeScript module: `constants/theme.ts` (the app, with
 * types) and `tailwind.config.js` (which is CommonJS and runs in Node at build time). If each had
 * its own copy, `bg-surface` and the theme token would drift apart without anyone noticing, and
 * `theme.test.ts` —which is what guarantees the contrast— would be checking the wrong copy.
 *
 * The reasoning behind each value is documented in `theme.ts`, which is where the tokens are read.
 */
const Colors = {
  dark: {
    background: '#061D3A', // Azul Profundo — the background of the app icon
    // Surfaces barely lifted off the background: almost all content lives in cards, so if they are
    // too light the blue dominating the screen stops being the brand's Azul Profundo.
    surface: '#0E2B4F', // from the manual (light/dark mode section)
    surfaceElevated: '#0D3567',
    border: '#123F76', // decorative (cards): it does not need 3:1
    borderStrong: '#4D9BFF', // the manual's secondary blue — 5.98:1 on the background, 5.04:1 on the card
    text: '#E8EFF7', // from the manual — 14.56:1 on background, 12.27:1 on surface (AAA)
    textSecondary: '#9FB8D4', // from the manual — 8.26:1 on background (AAA)
    // Verde Lectura, the manual's variant for dark backgrounds: 8.99:1 on the background (AAA).
    // Here it does work both as fill and as text, so `primary` and `success` are the same colour.
    primary: '#2BD69A',
    primaryMuted: '#0B3A33',
    // DARK text on the green fill: 8.99:1. White on top would give 1.88:1 and fail.
    onPrimary: '#061D3A',
    // Here the fill already stands out on its own (8.99:1), so the border is the same colour: it
    // exists so the component has the same shape in both themes, not to add contrast.
    primaryEdge: '#2BD69A',
    danger: '#F3AAAD', // 7.09:1 AAA
    success: '#2BD69A', // the manual's Verde Lectura — 8.99:1 AAA
    successMuted: '#0B3A33',
    tabInactive: '#A9C0DE',
    // The modals' scrim. More opaque in dark: over an already dark background, a soft scrim does
    // not separate the content on top from the one behind it enough.
    overlay: 'rgba(2, 10, 22, 0.72)',
  },
  light: {
    background: '#F4F6F8', // Gris Niebla — from the manual
    // The single deviation from the manual, which asks for a white surface: the cards carry a wash
    // of Azul Sensor. With white surfaces over Gris Niebla the brand's blue appeared nowhere in
    // light mode, and the manual reserves precisely the "surface" role for it.
    surface: '#E4EDFB', // 12 % of #1256D4 over white
    // White for whatever goes *on top of* a card: it separates by luminance, not only by border.
    surfaceElevated: '#FFFFFF',
    border: '#BFD2F5', // decorative (cards): it does not need 3:1
    borderStrong: '#5B7FB9', // controls: 3.74:1 on the background, 3.44:1 on the card
    text: '#061D3A', // from the manual — 15.57:1 AAA
    textSecondary: '#33475E', // from the manual — 8.80:1 AAA
    // Verde Lectura exactly as the manual has it. It is a FILL: 2.44:1 as text on the background,
    // but 6.39:1 with the deep-blue text on top, which is exactly the button the manual draws.
    primary: '#1FB57A',
    primaryMuted: '#DFF5EB',
    onPrimary: '#061D3A', // from the manual — 6.39:1 on the green
    // The green fill on the light background gives 2.44:1: below the 3:1 WCAG 1.4.11 asks of a
    // control's **boundary**. It is solved the right way —by outlining it— and not by lightening the
    // background or darkening the brand: the border gives 7.19:1 and the button stays brand green.
    primaryEdge: '#105E3F',
    danger: '#A5171C', // 7.08:1 AAA
    // The same green does not work as TEXT in light (2.44:1). It is darkened to AAA keeping the
    // hue: it is the colour of status labels ("Conectado", "confirmado"), not of fills.
    success: '#105E3F', // 7.19:1 on the background, 6.61:1 on the card
    successMuted: '#DFF5EB',
    tabInactive: '#3D5273',
    overlay: 'rgba(6, 29, 58, 0.45)',
  },
};

module.exports = { Colors };
