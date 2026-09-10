/**
 * Summary of the connected device: name and battery.
 *
 * The network address and the firmware version used to be here and left on 2026-09-08: they are
 * diagnostics, and diagnostics now go to Supabase. A `192.168.4.1:8080` says nothing to whoever uses
 * the app, and if the network fails the screen itself says so in words.
 *
 * The battery is communicated **as text**, not only as the bar: for a blind user the bar does not
 * exist, and for a low-vision one an indicator that only changes colour says nothing. The bar is
 * visual reinforcement of the number, never its replacement.
 */
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { strings } from '@/i18n';
import type { DeviceInfo } from './types';

/** Below this it is announced explicitly, on top of tinting the bar. */
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

      {device.id.startsWith('simulated') && (
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
            // Visual reinforcement of the number above; it carries no information of its own, so it
            // is hidden from the screen reader to avoid repeating the datum.
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

    </View>
  );
}
