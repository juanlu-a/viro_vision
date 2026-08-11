/**
 * Verificación automática de contraste WCAG de los tokens de color.
 *
 * Existe porque el manual de marca y la accesibilidad tiran para lados distintos: los hex del
 * manual fallan como color de texto (Azul Sensor sobre Azul Profundo da 2.66:1). Sin este test,
 * cualquiera puede "corregir" un token para que coincida con el manual y degradar la app sin
 * enterarse. Acá el contraste deja de depender de que alguien se acuerde de chequearlo.
 *
 * Objetivo AAA (7:1) para texto; AA (4.5:1) como piso donde se justifica.
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

  it('el color primario alcanza AAA sobre el fondo', () => {
    expect(contrastRatio(theme.primary, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('el texto sobre el relleno primario alcanza AAA', () => {
    // El error clásico con esta paleta: blanco sobre el verde de marca da 2.64:1.
    expect(contrastRatio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(AAA);
  });

  it('el color de peligro alcanza AAA sobre el fondo', () => {
    expect(contrastRatio(theme.danger, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('el color de éxito alcanza AAA sobre el fondo', () => {
    expect(contrastRatio(theme.success, theme.background)).toBeGreaterThanOrEqual(AAA);
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

describe('los hex crudos del manual de marca NO sirven como tokens de texto', () => {
  // Documenta por qué los tokens no son los del manual. Si algún día estos valores pasaran,
  // habría que revisar la decisión — pero hoy fallan y el test lo deja asentado.
  it('Azul Sensor sobre Azul Profundo falla WCAG', () => {
    expect(contrastRatio('#1256D4', '#061D3A')).toBeLessThan(3);
  });

  it('Verde Lectura sobre Gris Niebla falla WCAG', () => {
    expect(contrastRatio('#1FB57A', '#F4F6F8')).toBeLessThan(3);
  });

  it('blanco sobre Verde Lectura falla WCAG', () => {
    expect(contrastRatio('#FFFFFF', '#1FB57A')).toBeLessThan(3);
  });
});
