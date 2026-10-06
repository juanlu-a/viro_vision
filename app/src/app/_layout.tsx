import '@/global.css';

import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccessibleButton } from '@/components/accessible-button';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { isProxyConfigured } from '@/services/cloud';
import { errorDetail, errorType, record, startTelemetry, isTelemetryConfigured } from '@/services/telemetry';
import { AudioOutputProvider } from '@/features/audio/AudioOutputProvider';
import { DeviceProvider } from '@/features/device/DeviceProvider';
import { ProductModelProvider } from '@/features/reader/ProductModelProvider';
import { ReaderBridge } from '@/features/reader/ReaderBridge';
import { configureAudioSession } from '@/services/audio/session';
import { strings } from '@/i18n';

SplashScreen.preventAutoHideAsync();

// ExecuTorch downloads its models on its own and needs to know with what. It is configured once, at
// startup: doing it on first use would leave that call competing with the initialization.
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

// The app ships dark only (ADR 0010): the navigation theme is built once, from the same tokens the
// screens use, so the system chrome (headers, tab bar background) never disagrees with them.
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.danger,
  },
};

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

  // The audio session, once, before anything can want to speak. Without it iOS leaves the app on a
  // category that is not allowed to make a sound with the screen locked — and this app's interface
  // IS the voice (ADR 0001), on a phone that lives in a pocket (ADR 0003 §2). It never throws.
  useEffect(() => {
    void configureAudioSession().then((ok) => record('audio.session', { detail: { ok, at: 'startup' } }));
  }, []);

  return (
    <>
      {/* The supermarket model is chosen in Settings and used on Home: the state has to be a single
          one, above both tabs. */}
      <ProductModelProvider>
        {/* Where the reading is heard is chosen in Settings and applied by the reading pipeline, so
            like the model it has to be a single state above both tabs. It also restores the stored
            choice into the module the pipeline reads. */}
        <AudioOutputProvider>
          <DeviceProvider>
            {/* Renders nothing. It hands the reading pipeline the app's live values and subscribes it
                to the device's button, above every screen: the button has to work whatever is on
                screen, and with the screen off there is nothing on it at all. */}
            <ReaderBridge />
            <RootNavigator />
          </DeviceProvider>
        </AudioOutputProvider>
      </ProductModelProvider>
    </>
  );
}

function RootNavigator() {
  useEffect(() => {
    // Until 2026-09-14 the splash was held until the stored theme preference had been read, so the
    // app would not paint with one scheme and jump to the other. With a single scheme there is
    // nothing to wait for: the splash (itself Azul Profundo) hands over to the same colour.
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={NAV_THEME}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * What replaces a screen that threw while rendering (Expo Router picks up this export for the root
 * route). Without it the user got React's red box in development and a blank app in production.
 *
 * Since 2026-10-06 the app never shows an error: the error goes to telemetry with its stack, and the
 * user gets one plain sentence and a way back. It is spoken too (iOS needs the explicit announcement,
 * see `convenciones.md`): a screen that silently changed is invisible to whoever cannot see it.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    record('app.renderError', {
      detail: {
        type: errorType(error),
        message: errorDetail(error),
        stack: typeof error?.stack === 'string' ? error.stack.slice(0, 2_000) : null,
      },
    });
    AccessibilityInfo.announceForAccessibility(strings.recovery.message);
  }, [error]);

  return (
    <View
      style={{ flex: 1, justifyContent: 'center', gap: 24, padding: 24, backgroundColor: Colors.dark.background }}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {strings.recovery.message}
      </ThemedText>
      <AccessibleButton label={strings.recovery.restart} hint={strings.recovery.restartHint} onPress={() => void retry()} />
    </View>
  );
}
