/**
 * Contenedor estándar de pantalla: fondo del tema, safe area, ancho máximo centrado, espaciado
 * consistente, un modo scroll opcional y pull-to-refresh opcional.
 *
 * **Los insets, en iOS, los maneja UIKit** (`contentInsetAdjustmentBehavior="automatic"`), no
 * `SafeAreaView`. Es la única forma de que el contenido termine POR ENCIMA de la barra de
 * pestañas flotante de iOS 26: la barra no es parte del safe area clásico, pero sí del
 * `adjustedContentInset` que UIKit calcula por scroll view. Con el manejo manual anterior, el
 * final de la pantalla quedaba escondido detrás de la barra.
 *
 * Por eso en iOS el `SafeAreaView` no aplica el borde superior en modo scroll: lo aplica UIKit, y
 * aplicarlo dos veces era el bug del scroll que saltaba. En Android (donde `automatic` no existe
 * y la barra de pestañas no flota sobre el contenido) se mantiene el safe area clásico.
 */
import { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  /**
   * Tirar hacia abajo para refrescar. Sólo tiene sentido con `scroll`; el spinner gira hasta que
   * la promesa resuelva.
   */
  onRefresh?: () => Promise<void>;
};

/** El bloque de contenido: ancho máximo, centrado, con el padding y el ritmo de la app. */
const CONTENT = 'w-full max-w-content self-center gap-four p-four';

export function Screen({ children, scroll = false, edges, onRefresh }: ScreenProps) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const refrescar = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // En iOS con scroll, el inset superior lo pone UIKit; en el resto de los casos, SafeAreaView.
  const resolvedEdges = edges ?? (scroll && Platform.OS === 'ios' ? [] : ['top']);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={resolvedEdges}>
        {scroll ? (
          <ScrollView
            // Sin `justify-center`: centraba verticalmente el contenido corto y el título de una
            // pantalla con scroll caía más abajo que el de una sin scroll.
            contentContainerClassName="grow"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refrescar}
                  // El spinner hereda el acento para verse sobre ambos temas.
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                />
              ) : undefined
            }>
            <View className={CONTENT}>{children}</View>
          </ScrollView>
        ) : (
          <View className={`flex-1 ${CONTENT}`}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
