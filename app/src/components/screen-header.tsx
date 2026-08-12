/**
 * Encabezado de pantalla: símbolo de marca a la izquierda, título al lado, subtítulo debajo.
 *
 * El símbolo va acá y no en cada pantalla para que **todas tengan la misma estructura**: si una
 * lleva marca y otra no, los títulos caen a distinta altura y la app se siente descosida. Inicio
 * usa la variante grande; el resto la chica.
 *
 * Hay **dos archivos de símbolo**, no uno recoloreado: el manual define la pupila azul profundo
 * sobre claro y blanca sobre oscuro, y una sola imagen no puede cumplir las dos cosas — con la
 * pupila blanca sobre fondo claro el ojo se ve hueco.
 *
 * El símbolo es decorativo para el lector de pantalla — el título ya dice en qué pantalla estás,
 * y anunciar "imagen" antes de cada encabezado sería ruido en cada navegación.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';

/** `large` sólo en Inicio; `none` cuando la pantalla ya muestra la marca de otra forma. */
export type HeaderMark = 'large' | 'small' | 'none';

const MARK_SIZE: Record<Exclude<HeaderMark, 'none'>, number> = {
  large: 56,
  small: 40,
};

export function ScreenHeader({
  title,
  subtitle,
  mark = 'small',
}: {
  title: string;
  subtitle?: string;
  mark?: HeaderMark;
}) {
  const { scheme } = useThemePreference();

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {mark !== 'none' && (
          <Image
            source={
              scheme === 'dark'
                ? require('@/../assets/images/symbol-dark.png')
                : require('@/../assets/images/symbol-light.png')
            }
            style={{ width: MARK_SIZE[mark], height: MARK_SIZE[mark] }}
            contentFit="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
        {/* `flex: 1` para que el título envuelva en dos líneas en vez de empujar al símbolo
            fuera de pantalla cuando el usuario agranda el tipo del sistema. */}
        <ThemedText type="title" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
      </View>
      {subtitle ? (
        <ThemedText type="default" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    flex: 1,
  },
});
