import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { DeviceSummary } from '@/features/device/DeviceSummary';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
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
    <Screen
      scroll
      // Tirar hacia abajo = buscar/actualizar el dispositivo: el gesto estándar de "traeme la
      // información fresca", aplicado a lo único que esta pantalla informa. Si ya hay una
      // operación en vuelo, el gesto no la pisa.
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
          accessibilityLabel={`${t.statusLabel}: ${state.message}`}>
          <View className="h-[12px] w-[12px] rounded-pill" style={{ backgroundColor: dotColor }} />
          <View className="flex-1 gap-[2px]">
            <ThemedText type="small" themeColor="textSecondary">
              {t.statusLabel.toUpperCase()}
            </ThemedText>
            <ThemedText type="default" className="font-sans-bold">
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
