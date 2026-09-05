import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { DeviceSummary } from '@/features/device/DeviceSummary';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { useDeviceConnection } from '@/features/device/useDeviceConnection';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

export default function ConnectScreen() {
  const t = strings.connect;
  const theme = useTheme();
  const { state, wifi, wifiDetalle, direccion, connect, disconnect, medir, medirWifi, medicion } = useDeviceConnection();
  const wifiTexto = { 'sin-red': t.wifiSinRed, uniendose: t.wifiUniendose, listo: t.wifiListo, error: t.wifiError }[wifi];
  const wifiCompleto = wifiDetalle ? `${wifiTexto}. ${wifiDetalle}` : wifiTexto;

  const isConnected = state.status === 'connected';
  const isBusy = state.status === 'scanning' || state.status === 'connecting';
  const dotColor =
    isConnected ? theme.success : state.status === 'error' ? theme.danger : theme.textSecondary;

  // La voz es la interfaz: el número que decide el ADR 0003 se dice en voz alta, no sólo se muestra.
  const medirYAnunciar = async () => {
    announce(t.measuring);
    announce(await medir());
  };
  const medirWifiYAnunciar = async () => {
    announce(t.measuring);
    announce(await medirWifi());
  };

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
          <DeviceSummary device={{ ...state.device, direccion }} />
          <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`${t.wifiLabel}: ${wifiCompleto}`}>
            <ThemedText type="small" themeColor="textSecondary">
              {t.wifiLabel}
            </ThemedText>
            <ThemedText type="small">{wifiCompleto}</ThemedText>
          </View>
        </Card>
      )}

      {isConnected && medicion.mensaje && (
        <Card>
          <View
            className="gap-[2px]"
            accessible
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${t.measureSection}: ${medicion.mensaje}`}>
            <ThemedText type="small" themeColor="textSecondary">
              {t.measureSection.toUpperCase()}
            </ThemedText>
            <ThemedText type="default">{medicion.mensaje}</ThemedText>
          </View>
        </Card>
      )}

      {isConnected ? (
        <>
          <AccessibleButton
            label={t.measureButton}
            hint={t.measureHint}
            loading={medicion.midiendo}
            onPress={medirYAnunciar}
          />
          <AccessibleButton
            label={t.measureWifiButton}
            hint={t.measureWifiHint}
            loading={medicion.midiendo}
            disabled={!direccion}
            onPress={medirWifiYAnunciar}
          />
          <AccessibleButton
            label={t.disconnectButton}
            hint={t.disconnectHint}
            variant="secondary"
            disabled={medicion.midiendo}
            onPress={disconnect}
          />
        </>
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
