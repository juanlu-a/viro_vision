/**
 * Recetas de superficie del design system.
 *
 * Los colores nunca estuvieron sueltos —salen todos de `Colors`— pero la *composición* sí se
 * repetía: "borde de 1, radio, fondo de superficie, color de borde" estaba copiada en la tarjeta,
 * en el campo de texto y en el desplegable de tema. Copiada significa que cambiarla en un lugar y
 * olvidarse de otro es cuestión de tiempo, y que dos cosas que deberían verse igual se van
 * separando sin que nadie lo decida.
 *
 * Acá cada receta vive una sola vez y sale ya teñida por el tema activo. Lo que **no** va acá son
 * los tamaños y espaciados propios de un componente: eso es del componente, no del sistema.
 */
import { useMemo } from 'react';
import type { ViewStyle } from 'react-native';

import { A11y, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface Surfaces {
  /** Contenedor de contenido agrupado: tarjetas, secciones. */
  panel: ViewStyle;
  /** Contenedor elevado, para lo que va *encima* de un panel. */
  panelElevated: ViewStyle;
  /** Control interactivo en reposo: campos, disparadores de menú. */
  control: ViewStyle;
  /** Velo de fondo de un modal. */
  overlay: ViewStyle;
}

export function useSurfaces(): Surfaces {
  const theme = useTheme();

  return useMemo(
    () => ({
      panel: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: Radius.lg,
        padding: Spacing.four,
        gap: Spacing.three,
      },
      panelElevated: {
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: Radius.lg,
      },
      control: {
        backgroundColor: theme.surfaceElevated,
        // `borderStrong` y no `border`: el borde de un control es lo que lo identifica como tal, y
        // WCAG 1.4.11 le exige 3:1. El decorativo de las tarjetas no tiene esa obligación.
        borderColor: theme.borderStrong,
        borderWidth: 1,
        borderRadius: Radius.md,
        minHeight: A11y.minTouchTarget,
        paddingHorizontal: Spacing.three,
      },
      overlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: theme.overlay,
      },
    }),
    [theme],
  );
}
