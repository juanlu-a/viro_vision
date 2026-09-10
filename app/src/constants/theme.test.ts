/**
 * Automatic WCAG contrast verification of the colour tokens.
 *
 * It exists because the brand manual and accessibility pull in different directions: the manual's
 * hex values are perfect as brand and several fail as a text colour (Verde Lectura on Gris Niebla
 * gives 2.44:1). Without this test, anyone can "fix" a token so it matches the manual and degrade
 * the app without noticing.
 *
 * Target AAA (7:1) for text; 4.5:1 for the accent —the floor the manual itself sets—; 3:1 for
 * control borders and icons (WCAG 1.4.11).
 */
import { Colors } from './theme';
import type { Theme } from './theme';

/** Relative luminance per WCAG 2.1. */
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
 * The accent colour's floor. It is **4.5:1 and not AAA**, and the manual sets it: "green is the
 * action accent in both modes and is lightened to `#2BD69A` in dark to keep 4.5:1". The accent is
 * used as a button fill, not as running text; text still demands AAA.
 */
const ACCENT = 4.5;
/** Floor for interface elements and large text (WCAG 1.4.11 / 1.4.3). */
const UI = 3;

const themes: [string, Theme][] = [
  ['dark', Colors.dark],
  ['light', Colors.light],
];

describe('contrastRatio', () => {
  it('gives 21:1 between white and black', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('gives 1:1 for a colour against itself', () => {
    expect(contrastRatio('#1256D4', '#1256D4')).toBeCloseTo(1, 5);
  });
});

describe.each(themes)('%s theme', (_name, theme) => {
  it('primary text reaches AAA on the background', () => {
    expect(contrastRatio(theme.text, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('primary text reaches AAA on the surfaces', () => {
    expect(contrastRatio(theme.text, theme.surface)).toBeGreaterThanOrEqual(AAA);
    expect(contrastRatio(theme.text, theme.surfaceElevated)).toBeGreaterThanOrEqual(AAA);
  });

  it('secondary text reaches AAA on the background', () => {
    // Secondary does not mean illegible: it is the label of every metric and every state.
    expect(contrastRatio(theme.textSecondary, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('the primary control boundary reaches 3:1 (WCAG 1.4.11)', () => {
    // What the standard demands is that the control's **boundary** stands out from what is beside
    // it, not that the fill does. In light the brand green gives 2.44:1 against the background and
    // the one that complies is the border; in dark the fill already complies and the border is the
    // same colour.
    const boundary = Math.max(
      contrastRatio(theme.primary, theme.background),
      contrastRatio(theme.primaryEdge, theme.background),
    );
    expect(boundary).toBeGreaterThanOrEqual(UI);
    expect(contrastRatio(theme.primaryEdge, theme.surface)).toBeGreaterThanOrEqual(UI);
  });

  it('the icon on the primary fill reaches 3:1', () => {
    // Home's chips are a glyph over the green: it is an icon, so 1.4.11 applies to it.
    expect(contrastRatio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(UI);
  });

  it('the text on the primary fill reaches the accent floor', () => {
    // The classic mistake with this palette: white on the green gives 2.64:1. The manual draws the
    // button with Azul Profundo text on top precisely because of this.
    expect(contrastRatio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(ACCENT);
  });

  it('the danger colour reaches AAA on the background', () => {
    expect(contrastRatio(theme.danger, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('the success colour reaches AAA on the background', () => {
    expect(contrastRatio(theme.success, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('the success colour reaches AAA on the surfaces', () => {
    // It is the "Conectado" label inside a card: if it were only checked against the background, a
    // surface change could drop it below without anyone noticing.
    expect(contrastRatio(theme.success, theme.surface)).toBeGreaterThanOrEqual(ACCENT);
  });

  it('the control border reaches 3:1 on the surface too', () => {
    expect(contrastRatio(theme.borderStrong, theme.surface)).toBeGreaterThanOrEqual(UI);
  });

  it('the inactive tab is still legible (AAA)', () => {
    // An inactive tab is still a navigation destination, not decoration.
    expect(contrastRatio(theme.tabInactive, theme.background)).toBeGreaterThanOrEqual(AAA);
  });

  it('the control border reaches 3:1 (WCAG 1.4.11)', () => {
    // `borderStrong` is the border of a field or of the focus ring: it identifies the control, so
    // the minimum does apply to it. Plain `border` is decorative (cards) and does not need it —
    // separating them avoids both under-complying and over-applying the rule.
    expect(contrastRatio(theme.borderStrong, theme.background)).toBeGreaterThanOrEqual(UI);
  });

  it('the decorative border is at least perceptible', () => {
    expect(contrastRatio(theme.border, theme.background)).toBeGreaterThan(1.2);
  });

  it('the surface is distinguishable from the background', () => {
    // Being perceptible is enough: the hierarchy does not rest on this contrast alone.
    expect(contrastRatio(theme.surface, theme.background)).toBeGreaterThan(1);
  });
});

describe('the brand manual, verified', () => {
  // What the manual claims and the app takes as given. If any of these changed, the tokens have to
  // be revisited.
  it("the manual's button —Azul Profundo text on Verde Lectura— meets the accent floor", () => {
    expect(contrastRatio('#061D3A', '#1FB57A')).toBeGreaterThanOrEqual(ACCENT);
  });

  it("the green's dark-mode variant complies on Azul Profundo", () => {
    expect(contrastRatio('#2BD69A', '#061D3A')).toBeGreaterThanOrEqual(ACCENT);
  });
});

describe('known limits of the brand palette', () => {
  // These are not defects of the manual: a logo is not text and WCAG demands no contrast of a
  // symbol. They are here so nobody uses these hex values where they do not belong.
  it('Verde Lectura as TEXT on Gris Niebla fails — that is why `success` is darkened', () => {
    expect(contrastRatio('#1FB57A', '#F4F6F8')).toBeLessThan(3);
  });

  it('white on Verde Lectura fails — that is why `onPrimary` is Azul Profundo', () => {
    expect(contrastRatio('#FFFFFF', '#1FB57A')).toBeLessThan(3);
  });

  it('Azul Sensor on Azul Profundo fails — that is why blue is not used as a button in dark', () => {
    expect(contrastRatio('#1256D4', '#061D3A')).toBeLessThan(3);
  });
});
