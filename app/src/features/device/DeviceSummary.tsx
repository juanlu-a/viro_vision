/**
 * Resumen del dispositivo conectado: nombre, batería y firmware.
 *
 * La batería se comunica **por texto**, no sólo por la barra: para un usuario ciego la barra no
 * existe, y para uno con baja visión un indicador que sólo cambia de color no dice nada. La barra
 * es refuerzo visual del número, nunca su reemplazo.
 */
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { strings } from '@/i18n';
import type { DeviceInfo } from './types';

/** Debajo de esto se avisa explícitamente, además de teñir la barra. */
const LOW_BATTERY = 20;

export function DeviceSummary({ device }: { device: DeviceInfo }) {
  const t = strings.connect;

  const name = device.name ?? t.deviceUnnamed;
  const level = device.batteryLevel;
  const isLow = level != null && level <= LOW_BATTERY;
  const batteryText = level == null ? t.batteryUnknown : `${level} %`;

  return (
    <View className="gap-three">
      <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
        {t.deviceSection.toUpperCase()}
      </ThemedText>

      {device.id.startsWith('simulado') && (
        <ThemedText type="small" themeColor="danger">
          {t.deviceSimulated}
        </ThemedText>
      )}

      <View accessible accessibilityRole="text" accessibilityLabel={`${t.deviceNameLabel}: ${name}`}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.deviceNameLabel}
        </ThemedText>
        <ThemedText type="default" className="font-sans-bold">
          {name}
        </ThemedText>
      </View>

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${t.batteryLabel}: ${batteryText}${isLow ? `. ${t.batteryLow}` : ''}`}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.batteryLabel}
        </ThemedText>
        <ThemedText type="default" className="font-sans-bold">
          {batteryText}
          {isLow ? ` — ${t.batteryLow}` : ''}
        </ThemedText>
        {level != null && (
          <View
            // Refuerzo visual del número de arriba; no aporta información propia, así que se
            // oculta del lector de pantalla para no repetir el dato.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="mt-two h-[10px] overflow-hidden rounded-pill bg-surface-elevated">
            <View
              className={`h-full rounded-pill ${isLow ? 'bg-danger' : 'bg-success'}`}
              style={{ width: `${Math.max(0, Math.min(100, level))}%` }}
            />
          </View>
        )}
      </View>

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${t.addressLabel}: ${device.direccion ? `${device.direccion.ip}, puerto ${device.direccion.puerto}` : t.addressNone}`}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.addressLabel}
        </ThemedText>
        <ThemedText type="small">
          {device.direccion ? `${device.direccion.ip}:${device.direccion.puerto}` : t.addressNone}
        </ThemedText>
      </View>

      {device.firmwareVersion && (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${t.firmwareLabel}: ${device.firmwareVersion}`}>
          <ThemedText type="small" themeColor="textSecondary">
            {t.firmwareLabel}
          </ThemedText>
          <ThemedText type="small">{device.firmwareVersion}</ThemedText>
        </View>
      )}
    </View>
  );
}
