/**
 * Dispositivo: en qué anda la placa y los dos controles que el usuario tiene sobre ella.
 *
 * Hasta el 2026-09-08 esta pantalla era además la consola del proyecto: dos botones para medir la
 * transferencia (el spike del ADR 0003, ya decidido a favor de WiFi) y el volcado crudo de lo que
 * la placa informa de sí misma. Con los logs en Supabase eso se lee donde se lee un log, no en la
 * pantalla de alguien que no la ve. Queda lo que el usuario puede usar o necesita saber: si el
 * dispositivo está, cómo está su red, su batería, y los avisos cuando algo le falla.
 */
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { DeviceSummary } from '@/features/device/DeviceSummary';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useDispositivo } from '@/features/device/DispositivoProvider';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

export default function ConnectScreen() {
  const t = strings.connect;
  const theme = useTheme();
  const { conexion, wifi, wifiDetalle, ultimoAviso, connect, disconnect } = useDispositivo();
  const wifiTexto = { 'sin-red': t.wifiSinRed, uniendose: t.wifiUniendose, listo: t.wifiListo, error: t.wifiError }[wifi];
  // El detalle sólo aparece cuando la red falló, y dice qué hacer: no es diagnóstico, es el motivo
  // por el que no se puede leer.
  const wifiCompleto = wifiDetalle ? `${wifiTexto}. ${wifiDetalle}` : wifiTexto;

  const isConnected = conexion.status === 'connected';
  const isBusy = conexion.status === 'scanning' || conexion.status === 'connecting';
  const dotColor =
    isConnected ? theme.success : conexion.status === 'error' ? theme.danger : theme.textSecondary;

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
          accessibilityLabel={`${t.statusLabel}: ${conexion.message}`}>
          <View className="h-[12px] w-[12px] rounded-pill" style={{ backgroundColor: dotColor }} />
          <View className="flex-1 gap-[2px]">
            <ThemedText type="small" themeColor="textSecondary">
              {t.statusLabel.toUpperCase()}
            </ThemedText>
            <ThemedText type="default" className="font-sans-bold">
              {conexion.message}
            </ThemedText>
          </View>
        </View>
      </Card>

      {isConnected && conexion.device && (
        <Card>
          <DeviceSummary device={conexion.device} />
          <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`${t.wifiLabel}: ${wifiCompleto}`}>
            <ThemedText type="small" themeColor="textSecondary">
              {t.wifiLabel}
            </ThemedText>
            <ThemedText type="small">{wifiCompleto}</ThemedText>
          </View>
          {ultimoAviso && (
            <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`${t.deviceErrorLabel}: ${ultimoAviso}`}>
              <ThemedText type="small" themeColor="danger">
                {t.deviceErrorLabel}
              </ThemedText>
              <ThemedText type="small">{ultimoAviso}</ThemedText>
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
