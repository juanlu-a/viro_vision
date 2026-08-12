import { StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { DeviceSummary } from '@/features/device/DeviceSummary';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useDeviceConnection } from '@/features/device/useDeviceConnection';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

export default function ConnectScreen() {
  const t = strings.connect;
  const theme = useTheme();
  const { state, connect, disconnect } = useDeviceConnection();

  const isConnected = state.status === 'connected';
  const isBusy = state.status === 'scanning' || state.status === 'connecting';
  const dotColor =
    isConnected ? theme.success : state.status === 'error' ? theme.danger : theme.textSecondary;

  return (
    <Screen>
      <ScreenHeader title={t.title} subtitle={t.intro} />

      <Card>
        <View
          style={styles.statusRow}
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${t.statusLabel}: ${state.message}`}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <View style={styles.statusText}>
            <ThemedText type="small" themeColor="textSecondary">
              {t.statusLabel.toUpperCase()}
            </ThemedText>
            <ThemedText type="default" style={styles.statusValue}>
              {state.message}
            </ThemedText>
          </View>
        </View>
      </Card>

      {isConnected && state.device && (
        <Card>
          <DeviceSummary device={state.device} />
        </Card>
      )}

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
          loading={isBusy}
          onPress={connect}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  statusValue: {
    fontFamily: Fonts.sansBold,
  },
});
