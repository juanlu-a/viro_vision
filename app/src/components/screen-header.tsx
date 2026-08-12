/**
 * Encabezado de pantalla: símbolo de marca, título y subtítulo opcional.
 *
 * El símbolo va acá y no en cada pantalla para que **todas tengan la misma estructura**: si una
 * lleva marca y otra no, los títulos caen a distinta altura y la app se siente descosida. Inicio
 * usa la variante grande; el resto la chica.
 *
 * El símbolo es decorativo para el lector de pantalla — el título ya dice en qué pantalla estás,
 * y anunciar "imagen" antes de cada encabezado sería ruido en cada navegación.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** `large` sólo en Inicio; `none` cuando la pantalla ya muestra la marca de otra forma. */
export type HeaderMark = 'large' | 'small' | 'none';

const MARK_SIZE: Record<Exclude<HeaderMark, 'none'>, number> = {
  large: 84,
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
  return (
    <View style={styles.container}>
      {mark !== 'none' && (
        <Image
          source={require('@/../assets/images/splash-icon.png')}
          style={{ width: MARK_SIZE[mark], height: MARK_SIZE[mark] }}
          contentFit="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <ThemedText type="title" accessibilityRole="header">
        {title}
      </ThemedText>
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
});
