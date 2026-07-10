import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { announce } from '@/features/audio/announcer';
import { strings } from '@/i18n';

export default function HomeScreen() {
  const t = strings.home;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title" accessibilityRole="header">
          {t.title}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {t.subtitle}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <AccessibleButton
          label={t.connectButton}
          hint={t.connectHint}
          onPress={() => router.push('/connect')}
        />
        <AccessibleButton
          label={t.testAudioButton}
          hint={t.testAudioHint}
          variant="secondary"
          onPress={() => announce(t.testAudioPhrase)}
        />
        <AccessibleButton
          label={t.settingsButton}
          hint={t.settingsHint}
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.three,
  },
});
