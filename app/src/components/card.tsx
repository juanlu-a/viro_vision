/**
 * Contenedor de superficie: agrupa contenido relacionado.
 *
 * La receta visual (fondo, borde, radio, padding) vive en `useSurfaces`, no acá: era la misma que
 * usaban el campo de texto y el desplegable de tema, copiada tres veces.
 */
import { View, type ViewProps } from 'react-native';

import { useSurfaces } from '@/hooks/use-surfaces';

export function Card({ style, ...rest }: ViewProps) {
  const surfaces = useSurfaces();
  return <View {...rest} style={[surfaces.panel, style]} />;
}
