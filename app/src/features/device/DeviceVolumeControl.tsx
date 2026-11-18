/**
 * The level of the device's speaker, in Settings (2026-11-18).
 *
 * The device has no volume buttons, and once the amplifier went in (ADR 0012, update of 2026-11-18)
 * its fixed startup level was far too loud on a bone-conduction transducer pressed against the head.
 *
 * **Built from standard primitives, not a native slider.** No slider ships with this app and adding
 * one is a native module, which means a new development build for every tester. What a screen reader
 * needs is not the drawing but the semantics, and those RN gives to any view: the whole control is
 * one `adjustable` element whose value is spoken and that swipes up and down by `VOLUME_STEP`
 * (VoiceOver's increment/decrement; TalkBack's volume-key gesture). Sighted users get − and + buttons
 * of full touch-target size and a track they can tap; those are hidden from the screen reader, which
 * would otherwise read three controls for one setting.
 *
 * **The board is the source of truth.** The control shows what the board last reported (`vol` in
 * `status`), a local draft while the user is changing it, and writes once, after the burst
 * (`createVolumeSender`). Without a device, or with one too old to report a level, it says so instead
 * of showing a level nobody can change.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type AccessibilityActionEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

import { useDevice } from './DeviceProvider';
import { createVolumeSender, stepVolume, volumeAtPosition } from './volume';

// How long the draft outlives the write before the board's reported level takes over again. The board
// pushes a new `status` as soon as `amixer` finishes, well inside this; if the write was lost, the
// control goes back to the level the board actually has instead of claiming one it does not.
const DRAFT_TIMEOUT_MS = 3000;

export function DeviceVolumeControl() {
  const t = strings.settings;
  const theme = useTheme();
  const { connection, deviceVolume, writeVolume } = useDevice();
  const [draft, setDraft] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const sender = useRef<ReturnType<typeof createVolumeSender> | null>(null);

  // Built in an effect, not during render: the sender owns timers, and the write and the draft's
  // expiry both happen after the burst, outside any render.
  useEffect(() => {
    let draftTimer: ReturnType<typeof setTimeout> | null = null;
    sender.current = createVolumeSender((percent) => {
      void writeVolume(percent);
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = setTimeout(() => setDraft(null), DRAFT_TIMEOUT_MS);
    });
    return () => {
      sender.current?.cancel();
      sender.current = null;
      if (draftTimer) clearTimeout(draftTimer);
    };
  }, [writeVolume]);

  const available = connection.status === 'connected' && deviceVolume !== null;
  if (!available) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {connection.status === 'connected' ? t.deviceVolumeUnsupported : t.deviceVolumeNoDevice}
      </ThemedText>
    );
  }

  const level = draft ?? deviceVolume;
  const change = (next: number) => {
    if (next === level) return;
    Haptics.selectionAsync().catch(() => {});
    setDraft(next);
    sender.current?.push(next);
  };

  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') change(stepVolume(level, 1));
    if (event.nativeEvent.actionName === 'decrement') change(stepVolume(level, -1));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t.deviceVolume}
      accessibilityHint={t.deviceVolumeHint}
      accessibilityValue={{ min: 0, max: 100, now: level, text: `${level} %` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
      className="flex-row items-center gap-two">
      <Pressable
        onPress={() => change(stepVolume(level, -1))}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="min-h-touch min-w-[48px] items-center justify-center rounded-md border border-border-strong active:opacity-75">
        <Ionicons name="volume-low" size={22} color={theme.text} />
      </Pressable>

      <Pressable
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        onPress={(e) => change(volumeAtPosition(e.nativeEvent.locationX, trackWidth))}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="min-h-touch flex-1 justify-center">
        <View className="h-[10px] overflow-hidden rounded-md bg-surface-elevated">
          <View className="h-full bg-primary" style={{ width: `${level}%` }} />
        </View>
      </Pressable>

      <ThemedText
        type="smallBold"
        className="min-w-[48px] text-right"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {`${level} %`}
      </ThemedText>

      <Pressable
        onPress={() => change(stepVolume(level, 1))}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="min-h-touch min-w-[48px] items-center justify-center rounded-md border border-border-strong active:opacity-75">
        <Ionicons name="volume-high" size={22} color={theme.text} />
      </Pressable>
    </View>
  );
}
