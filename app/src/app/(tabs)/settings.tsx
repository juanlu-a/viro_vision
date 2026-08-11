import { router } from 'expo-router';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { strings } from '@/i18n';

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

      {/* Herramientas de medición de la tesis. Nunca en un build distribuible. */}
      {__DEV__ && (
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
