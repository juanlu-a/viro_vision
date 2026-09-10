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
import { record, startTelemetry, isTelemetryConfigured } from '@/services/telemetry';
import { DeviceProvider } from '@/features/device/DeviceProvider';
import { ProductModelProvider } from '@/features/reader/ProductModelProvider';
import {
  ThemePreferenceProvider,
  useThemePreference,
} from '@/features/theme/ThemePreferenceProvider';

SplashScreen.preventAutoHideAsync();

// ExecuTorch downloads its models on its own and needs to know with what. It is configured once, at
// startup: doing it on first use would leave that call competing with the initialization.
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
  // Telemetry starts once and is switched off on unmount. It goes at the very top so the global
  // error handler is installed before any screen mounts: a startup crash is exactly the one nobody
  // can record by hand.
  useEffect(() => {
    const stop = startTelemetry();
    // The session's context, once: without it, every later event has to be interpreted without
    // knowing which build or which configuration it was running under.
    record('app.start', {
      detail: {
        platform: Platform.OS,
        version: Platform.Version,
        withProxy: isProxyConfigured,
        withTelemetry: isTelemetryConfigured,
      },
    });
    return stop;
  }, []);

  return (
    <ThemePreferenceProvider>
      {/* The supermarket model is chosen in Settings and used on Home: the state has to be a single
          one, above both tabs. */}
      <ProductModelProvider>
        <DeviceProvider>
        <RootNavigator />
        </DeviceProvider>
      </ProductModelProvider>
    </ThemePreferenceProvider>
  );
}

function RootNavigator() {
  const { scheme, isReady } = useThemePreference();

  useEffect(() => {
    // The splash is held until we know which theme to apply: otherwise the app paints with one
    // scheme and jumps to the other, a disorienting flash for someone with low vision.
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
