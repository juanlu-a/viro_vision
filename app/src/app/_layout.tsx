import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import {
  ThemePreferenceProvider,
  useThemePreference,
} from '@/features/theme/ThemePreferenceProvider';

SplashScreen.preventAutoHideAsync();

// ExecuTorch descarga sus modelos por su cuenta y necesita saber con qué. Se configura una sola
// vez, al arrancar: hacerlo al usarlo dejaría la primera llamada compitiendo con la inicialización.
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

function buildNavTheme(scheme: 'light' | 'dark') {
  const c = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootNavigator />
    </ThemePreferenceProvider>
  );
}

function RootNavigator() {
  const { scheme, isReady } = useThemePreference();

  useEffect(() => {
    // El splash se mantiene hasta saber qué tema aplicar: si no, la app pinta con un esquema y
    // salta al otro, un parpadeo desorientador para alguien con baja visión.
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={buildNavTheme(scheme)}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            {/* Ruta de desarrollo: no es pestaña; se enlaza desde Ajustes (ver settings.tsx). */}
            <Stack.Screen name="dev/vision-bench" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
