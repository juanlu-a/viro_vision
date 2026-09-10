/**
 * Device: what the device is doing and the two controls the user has over it.
 *
 * Until 2026-09-08 this screen was also the project's console: two buttons to measure the transfer
 * (the ADR 0003 spike, already decided in favour of WiFi) and the raw dump of what the device
 * reports about itself. With the logs in Supabase that is read where a log is read, not on the
 * screen of someone who does not see it. What stays is what the user can use or needs to know:
 * whether the device is there, how its network is doing, its battery, and the notices when
 * something fails on it.
 */
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { DeviceSummary } from '@/features/device/DeviceSummary';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useDevice } from '@/features/device/DeviceProvider';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

export default function ConnectScreen() {
  const t = strings.connect;
  const theme = useTheme();
  const { connection, wifiDetail, lastNotice, connect, disconnect } = useDevice();
  // The Wi-Fi status line (off / joining / ready) is gone since 2026-09-09: it was device console,
  // and the app stopped being its own console. What stays is the REASON something did not work,
  // because for someone who does not see the screen that is the only explanation of why the button
  // did nothing. `wifiDetail` only appears when the network failed and it says what to do.
  const problem = wifiDetail ?? lastNotice;

  const isConnected = connection.status === 'connected';
  const isBusy = connection.status === 'scanning' || connection.status === 'connecting';
  const dotColor =
    isConnected ? theme.success : connection.status === 'error' ? theme.danger : theme.textSecondary;

  return (
    <Screen
      scroll
      // Pull down = search for / refresh the device: the standard "bring me fresh information"
      // gesture, applied to the only thing this screen reports. If an operation is already in
      // flight, the gesture does not step on it.
      onRefresh={async () => {
        if (!isBusy) await connect();
      }}>
      <ScreenHeader title={t.title} subtitle={t.intro} />

      <Card>
        <View
          className="flex-row items-center gap-three"
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${t.statusLabel}: ${connection.message}`}>
          <View className="h-[12px] w-[12px] rounded-pill" style={{ backgroundColor: dotColor }} />
          <View className="flex-1 gap-[2px]">
            <ThemedText type="small" themeColor="textSecondary">
              {t.statusLabel.toUpperCase()}
            </ThemedText>
            <ThemedText type="default" className="font-sans-bold">
              {connection.message}
            </ThemedText>
          </View>
        </View>
      </Card>

      {isConnected && connection.device && (
        <Card>
          <DeviceSummary device={connection.device} />
          {problem && (
            <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`${t.deviceErrorLabel}: ${problem}`}>
              <ThemedText type="small" themeColor="danger">
                {t.deviceErrorLabel}
              </ThemedText>
              <ThemedText type="small">{problem}</ThemedText>
            </View>
          )}
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
