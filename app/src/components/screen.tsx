/**
 * Contenedor estándar de pantalla: fondo del tema, safe area, ancho máximo centrado, espaciado
 * consistente y un modo scroll opcional.
 *
 * ⚠️ Si la pantalla muestra el **header nativo** (`headerShown: true`), pasá `edges={[]}`: el
 * header ya cubre el inset de arriba, y aplicarlo otra vez acá lo duplica.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
};

export function Screen({ children, scroll = false, edges = ['top'] }: ScreenProps) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.flex} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            // iOS ajusta solo el inset del primer ScrollView dentro de un navigation controller.
            // Con el header nativo visible eso se suma al safe-area que ya aplica `SafeAreaView`,
            // el inset se cuenta dos veces y el sistema "corrige" saltando el scroll hacia arriba
            // mientras se hace scroll. Los insets los manejamos nosotros, así que se apaga.
            contentInsetAdjustmentBehavior="never">
            <View style={styles.content}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex]}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  // Sin `justifyContent: center`: centraba verticalmente el contenido corto, y el título de una
  // pantalla con scroll caía más abajo que el de una sin scroll. Los encabezados tienen que
  // quedar en el mismo lugar en todas las pantallas.
  scrollContent: {
    flexGrow: 1,
  },
});
