import { StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDeviceConnection } from '@/features/device/useDeviceConnection';
import { strings } from '@/i18n';

export default function ConnectScreen() {
  const t = strings.connect;
  const { state, connect, disconnect } = useDeviceConnection();
  const isConnected = state.status === 'connected';
  const isBusy = state.status === 'scanning' || state.status === 'connecting';

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="default" themeColor="textSecondary">
          {t.intro}
        </ThemedText>
      </View>

      {/* Live region so the screen reader announces status changes as they happen. */}
      <View
        accessible
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${strings.home.deviceStatusLabel}: ${state.message}`}>
        <ThemedText type="small" themeColor="textSecondary">
          {strings.home.deviceStatusLabel}
        </ThemedText>
        <ThemedText type="subtitle">{state.message}</ThemedText>
      </View>

      <View style={styles.actions}>
        {isConnected ? (
          <AccessibleButton
            label={t.disconnectButton}
            hint={t.disconnectHint}
            variant="secondary"
            onPress={disconnect}
          />
        ) : (
          <AccessibleButton
            label={t.scanButton}
            hint={t.scanHint}
            disabled={isBusy}
            onPress={connect}
          />
        )}
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
