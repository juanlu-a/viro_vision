import { router } from 'expo-router';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { ThemeSelector } from '@/features/theme/ThemeSelector';
import { strings } from '@/i18n';
import { isVisionConfigured } from '@/services/vision';

export default function SettingsScreen() {
  const t = strings.settings;

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.appearance.toUpperCase()}
        </ThemedText>
        <ThemeSelector />
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.about.toUpperCase()}
        </ThemedText>
        <ThemedText type="default" style={{ fontFamily: Fonts.sansBold }}>
          {strings.app.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {strings.app.tagline}
        </ThemedText>
      </Card>

      {/*
        Herramientas de medición de la tesis. El gate es la presencia de la clave, no __DEV__:
        así el benchmark también existe en un build de release local (necesario para medir en la
        calle sin la laptop), pero desaparece solo en cualquier build que no lleve la clave —
        y la clave nunca debe viajar en un build distribuible (ver app/.env.example).
      */}
      {(__DEV__ || isVisionConfigured) && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {t.developer.toUpperCase()}
          </ThemedText>
          <AccessibleButton
            label={t.openBenchmark}
            hint={t.openBenchmarkHint}
            variant="ghost"
            onPress={() => router.push('/dev/vision-bench')}
          />
          {/* La sonda del runtime local va sólo en __DEV__: no hay clave de API que gatear, y
              todavía es un spike sin validar (ADR 0004). */}
          {__DEV__ && (
            <AccessibleButton
              label={strings.ondevice.title}
              hint={strings.ondevice.probeHint}
              variant="ghost"
              onPress={() => router.push('/dev/ondevice-bench')}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
