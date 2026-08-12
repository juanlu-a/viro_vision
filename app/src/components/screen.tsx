/**
 * Contenedor estándar de pantalla: fondo del tema, safe area, ancho máximo centrado, espaciado
 * consistente y un modo scroll opcional.
 *
 * ⚠️ Si la pantalla muestra el **header nativo** (`headerShown: true`), pasá `edges={[]}`: el
 * header ya cubre el inset de arriba, y aplicarlo otra vez acá lo duplica.
 */
import { ScrollView, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
};

/** El bloque de contenido: ancho máximo, centrado, con el padding y el ritmo de la app. */
const CONTENT = 'w-full max-w-content self-center gap-four p-four';

export function Screen({ children, scroll = false, edges = ['top'] }: ScreenProps) {
  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={edges}>
        {scroll ? (
          <ScrollView
            // Sin `justify-center`: centraba verticalmente el contenido corto y el título de una
            // pantalla con scroll caía más abajo que el de una sin scroll.
            contentContainerClassName="grow"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            // iOS ajusta solo el inset del primer ScrollView dentro de un navigation controller.
            // Con el header nativo visible eso se suma al safe-area que ya aplica `SafeAreaView`,
            // el inset se cuenta dos veces y el sistema "corrige" saltando el scroll hacia arriba
            // mientras se hace scroll. Los insets los manejamos nosotros, así que se apaga.
            contentInsetAdjustmentBehavior="never">
            <View className={CONTENT}>{children}</View>
          </ScrollView>
        ) : (
          <View className={`flex-1 ${CONTENT}`}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
