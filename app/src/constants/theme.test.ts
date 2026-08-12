/**
 * Verificación automática de contraste WCAG de los tokens de color.
 *
 * Existe porque el manual de marca y la accesibilidad tiran para lados distintos: los hex del
 * manual son perfectos como marca y varios fallan como color de texto (Verde Lectura sobre Gris
 * Niebla da 2.44:1). Sin este test, cualquiera puede "corregir" un token para que coincida con el
 * manual y degradar la app sin enterarse.
 *
 * Objetivo AAA (7:1) para texto; 4.5:1 para el acento —el piso que fija el propio manual—; 3:1
 * para bordes de control e íconos (WCAG 1.4.11).
 */
import { Colors } from './theme';
import type { Theme } from './theme';

/** Luminancia relativa según WCAG 2.1. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AAA = 7;
/**
 * Piso del color de acento. Es **4.5:1 y no AAA**, y lo fija el manual: "el verde es el acento de
 * acción en los dos modos y se aclara a `#2BD69A` en oscuro para mantener 4.5:1". El acento se usa
 * como relleno de botón, no como texto corrido; el texto sigue exigiendo AAA.
 */
const ACENTO = 4.5;
/** Piso para elementos de interfaz y texto grande (WCAG 1.4.11 / 1.4.3). */
const UI = 3;

const themes: [string, Theme][] = [
  ['oscuro', Colors.dark],
  ['claro', Colors.light],
];

describe('contrastRatio', () => {
  it('da 21:1 entre blanco y negro', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('da 1:1 para un color contra sí mismo', () => {
    expect(contrastRatio('#1256D4', '#1256D4')).toBeCloseTo(1, 5);
  });
});

describe.each(themes)('tema %s', (_name, theme) => {
  it('texto principal alcanza AAA sobre el fondo', () => {
    expect(contrastRatio(theme.text, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('texto principal alcanza AAA sobre las superficies', () => {
    expect(contrastRatio(theme.text, theme.surface)).toBeGreaterThanOrEqual(AAA);
    expect(contrastRatio(theme.text, theme.surfaceElevated)).toBeGreaterThanOrEqual(AAA);
  });

  it('texto secundario alcanza AAA sobre el fondo', () => {
    // Secundario no significa ilegible: es la etiqueta de cada métrica y de cada estado.
    expect(contrastRatio(theme.textSecondary, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('el límite del control primario alcanza 3:1 (WCAG 1.4.11)', () => {
    // Lo que la norma exige es que el **límite** del control se distinga de lo que tiene al lado,
    // no que el relleno lo haga. En claro el verde de marca da 2.44:1 contra el fondo y quien
    // cumple es el borde; en oscuro el relleno ya cumple y el borde es del mismo color.
    const limite = Math.max(
      contrastRatio(theme.primary, theme.background),
      contrastRatio(theme.primaryEdge, theme.background),
    );
    expect(limite).toBeGreaterThanOrEqual(UI);
    expect(contrastRatio(theme.primaryEdge, theme.surface)).toBeGreaterThanOrEqual(UI);
  });

  it('el ícono sobre el relleno primario alcanza 3:1', () => {
    // Los chips de Inicio son un glifo sobre el verde: es un ícono, así que le aplica 1.4.11.
    expect(contrastRatio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(UI);
  });

  it('el texto sobre el relleno primario alcanza el piso del acento', () => {
    // El error clásico con esta paleta: blanco sobre el verde da 2.64:1. El manual dibuja el botón
    // con texto Azul Profundo encima justamente por esto.
    expect(contrastRatio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(ACENTO);
  });

  it('el color de peligro alcanza AAA sobre el fondo', () => {
    expect(contrastRatio(theme.danger, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('el color de éxito alcanza AAA sobre el fondo', () => {
    expect(contrastRatio(theme.success, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('el color de éxito alcanza AAA sobre las superficies', () => {
    // Es el rótulo "Conectado" dentro de una tarjeta: si sólo se verificara contra el fondo, un
    // cambio de superficie podría dejarlo por debajo sin que nadie se entere.
    expect(contrastRatio(theme.success, theme.surface)).toBeGreaterThanOrEqual(ACENTO);
  });

  it('el borde de controles alcanza 3:1 también sobre la superficie', () => {
    expect(contrastRatio(theme.borderStrong, theme.surface)).toBeGreaterThanOrEqual(UI);
  });

  it('la pestaña inactiva sigue siendo legible (AAA)', () => {
    // Una pestaña inactiva sigue siendo un destino de navegación, no decoración.
    expect(contrastRatio(theme.tabInactive, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('el borde de controles alcanza 3:1 (WCAG 1.4.11)', () => {
    // `borderStrong` es el borde de un campo o del anillo de foco: identifica el control, así que
    // sí le aplica el mínimo. `border` a secas es decorativo (tarjetas) y no lo necesita —
    // separarlos evita tanto sub-cumplir como sobre-aplicar la regla.
    expect(contrastRatio(theme.borderStrong, theme.background)).toBeGreaterThanOrEqual(UI);
  });

  it('el borde decorativo al menos se percibe', () => {
    expect(contrastRatio(theme.border, theme.background)).toBeGreaterThan(1.2);
  });

  it('la superficie se distingue del fondo', () => {
    // Basta con que sea perceptible: la jerarquía no depende sólo de este contraste.
    expect(contrastRatio(theme.surface, theme.background)).toBeGreaterThan(1);
  });
});

describe('el manual de marca, verificado', () => {
  // Lo que el manual afirma y la app da por bueno. Si alguno cambiara, hay que revisar los tokens.
  it('el botón del manual —texto Azul Profundo sobre Verde Lectura— cumple el piso del acento', () => {
    expect(contrastRatio('#061D3A', '#1FB57A')).toBeGreaterThanOrEqual(ACENTO);
  });

  it('la variante para oscuro del verde cumple sobre Azul Profundo', () => {
    expect(contrastRatio('#2BD69A', '#061D3A')).toBeGreaterThanOrEqual(ACENTO);
  });
});

describe('límites conocidos de la paleta de marca', () => {
  // No son defectos del manual: un logo no es texto y WCAG no le exige contraste a un símbolo.
  // Están acá para que nadie use estos hex donde no van.
  it('Verde Lectura como TEXTO sobre Gris Niebla falla — por eso `success` se oscurece', () => {
    expect(contrastRatio('#1FB57A', '#F4F6F8')).toBeLessThan(3);
  });

  it('blanco sobre Verde Lectura falla — por eso `onPrimary` es Azul Profundo', () => {
    expect(contrastRatio('#FFFFFF', '#1FB57A')).toBeLessThan(3);
  });

  it('Azul Sensor sobre Azul Profundo falla — por eso el azul no se usa de botón en oscuro', () => {
    expect(contrastRatio('#1256D4', '#061D3A')).toBeLessThan(3);
  });
});
