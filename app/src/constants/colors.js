/**
 * Tabla de colores de la marca. **Única fuente de verdad**, en JavaScript plano a propósito.
 *
 * La consumen dos mundos que no pueden compartir un módulo TypeScript: `constants/theme.ts` (la
 * app, con tipos) y `tailwind.config.js` (que es CommonJS y corre en Node al construir). Si cada
 * uno tuviera su copia, `bg-surface` y el token del tema se separarían sin que nadie lo note, y
 * `theme.test.ts` —que es lo que garantiza el contraste— estaría verificando la copia equivocada.
 *
 * El porqué de cada valor está documentado en `theme.ts`, que es donde se leen los tokens.
 */
const Colors = {
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
};

module.exports = { Colors };
