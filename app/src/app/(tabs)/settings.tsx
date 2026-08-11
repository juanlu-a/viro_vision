import { router } from 'expo-router';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { strings } from '@/i18n';
import { isAnthropicConfigured } from '@/services/vision';

export default function SettingsScreen() {
  const t = strings.settings;

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.appearance.toUpperCase()}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {t.appearanceValue}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.about.toUpperCase()}
        </ThemedText>
        <ThemedText type="default" style={{ fontWeight: '600' }}>
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
      {(__DEV__ || isAnthropicConfigured) && (
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
        </Card>
      )}
    </Screen>
  );
}
