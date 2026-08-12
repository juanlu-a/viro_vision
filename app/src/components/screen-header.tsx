/**
 * Encabezado de pantalla: símbolo de marca a la izquierda, título al lado, subtítulo debajo.
 *
 * **El símbolo va sólo en Inicio.** Repetirlo en cada pantalla lo convertía en decoración: la
 * marca deja de decir "esta es la app" y pasa a ser ruido que se saltea. Lo que sí tienen que
 * compartir todas es la *estructura*, y de eso se encarga `minHeight` en la fila del título: con
 * o sin símbolo, el título cae siempre a la misma altura. Sin eso, el alto de la fila lo decidiría
 * el elemento más alto —el símbolo en Inicio, la línea de texto en el resto— y los títulos
 * quedarían desalineados entre pantallas.
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

/** `large` sólo en Inicio. El resto de las pantallas va sin marca. */
export type HeaderMark = 'large' | 'none';

const MARK_SIZE = 48;

/** Alto fijo de la fila del título: el del símbolo, lleve símbolo o no. */
const TITLE_ROW_HEIGHT = MARK_SIZE;

export function ScreenHeader({
  title,
  subtitle,
  mark = 'none',
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
            style={{ width: MARK_SIZE, height: MARK_SIZE }}
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
    minHeight: TITLE_ROW_HEIGHT,
  },
  title: {
    flex: 1,
  },
});
