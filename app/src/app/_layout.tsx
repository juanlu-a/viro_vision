import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { isProxyConfigured } from '@/services/cloud';
import { registrar, iniciarTelemetria, isTelemetriaConfigurada } from '@/services/telemetria';
import { DispositivoProvider } from '@/features/device/DispositivoProvider';
import { ModeloSupermercadoProvider } from '@/features/reader/ModeloSupermercadoProvider';
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
  // La telemetría arranca una sola vez y se apaga al desmontar. Va acá arriba de todo para que el
  // manejador global de errores quede puesto antes de que se monte cualquier pantalla: un crash del
  // arranque es justo el que nadie puede registrar a mano.
  useEffect(() => {
    const parar = iniciarTelemetria();
    // El contexto de la sesión, una vez: sin esto, cada evento posterior hay que interpretarlo sin
    // saber contra qué build ni con qué configuración corría.
    registrar('app.inicio', {
      detalle: {
        plataforma: Platform.OS,
        version: Platform.Version,
        conProxy: isProxyConfigured,
        conTelemetria: isTelemetriaConfigurada,
      },
    });
    return parar;
  }, []);

  return (
    <ThemePreferenceProvider>
      {/* El modelo de supermercado se elige en Ajustes y se usa en Inicio: el estado tiene que ser
          uno solo, arriba de las dos pestañas. */}
      <ModeloSupermercadoProvider>
        <DispositivoProvider>
        <RootNavigator />
        </DispositivoProvider>
      </ModeloSupermercadoProvider>
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
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
