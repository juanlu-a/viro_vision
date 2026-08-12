/**
 * Contenedor de superficie: agrupa contenido relacionado.
 *
 * Escrito con clases de Tailwind (vía NativeWind). Los nombres son **semánticos**: `bg-surface`,
 * no `bg-blue-900`. Un rol sobrevive a un cambio de marca; un color, no.
 *
 * No hace falta `dark:`: cada rol es una variable CSS y lo que cambia entre temas es su valor, no
 * la clase. Los hex salen de `constants/colors.js`, la misma tabla que verifica `theme.test.ts`.
 */
import { View, type ViewProps } from 'react-native';

export function Card({ className, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`gap-three rounded-lg border border-border bg-surface p-four ${className ?? ''}`}
    />
  );
}
