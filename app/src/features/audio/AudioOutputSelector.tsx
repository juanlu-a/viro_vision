/**
 * Where a supermarket reading is heard: the phone, or the device's speaker.
 *
 * Same shape as `ThemeSelector` and for the same reason: a one-line trigger whose label already
 * states what is in force ("Dónde se escucha: En el teléfono"), and a `radiogroup` with `checked` —
 * which is what tells a screen reader the options are mutually exclusive. Not a `Switch`: two named
 * destinations are not on/off, and "audio en el dispositivo, desactivado" says nothing about where
 * the sound actually goes.
 *
 * The choice is applied **and spoken**. Unlike the theme, this one changes what the user is about to
 * hear and where, so confirming it by voice is the only feedback available to someone who is not
 * looking at the screen.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';
import { isSynthesisEnabled } from '@/services/audio/synthesis';
import type { AudioOutput } from './audioOutput';

import { useAudioOutput } from './AudioOutputProvider';

type Option = {
  value: AudioOutput;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: Option[] = [
  {
    value: 'phone',
    label: strings.settings.audioOutputPhone,
    hint: strings.settings.audioOutputPhoneHint,
    icon: 'phone-portrait',
  },
  {
    value: 'device',
    label: strings.settings.audioOutputDevice,
    hint: strings.settings.audioOutputDeviceHint,
    icon: 'hardware-chip',
  },
];

export function AudioOutputSelector() {
  const { output, setOutput } = useAudioOutput();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const current = OPTIONS.find((o) => o.value === output) ?? OPTIONS[0];

  const choose = (value: AudioOutput) => {
    Haptics.selectionAsync().catch(() => {});
    setOutput(value);
    setOpen(false);
    // Said out loud because this setting decides where the next sentence comes from. When the build
    // cannot synthesize, choosing the device is honoured in storage but cannot work, and saying so
    // here is the only way the user finds out before wondering why the board stayed quiet.
    const label = OPTIONS.find((o) => o.value === value)?.label ?? '';
    const caveat = value === 'device' && !isSynthesisEnabled ? ` ${strings.settings.audioOutputNotConfigured}` : '';
    announce(`${strings.settings.audioOutput}: ${label}.${caveat}`);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${strings.settings.audioOutput}: ${current.label}`}
        accessibilityHint={strings.settings.audioOutputHint}
        onPress={() => setOpen(true)}
        className="min-h-touch flex-row items-center gap-two rounded-md border border-border-strong bg-surface-elevated px-three active:opacity-85">
        <Ionicons
          name={current.icon}
          size={20}
          color={theme.primary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <ThemedText type="smallBold" className="flex-1">
          {current.label}
        </ThemedText>
        <Ionicons
          name="chevron-down"
          size={18}
          color={theme.textSecondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>

      {/* The bus caveat is written where the choice is made, not in a help screen: it is the one
          thing about this setting that surprises, and ADR 0001 is the reason it cannot be otherwise. */}
      <ThemedText type="small" themeColor="textSecondary">
        {strings.settings.audioOutputBusNote}
      </ThemedText>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="absolute inset-0 bg-overlay"
          onPress={() => setOpen(false)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View className="flex-1 justify-center p-four" pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            accessibilityRole="radiogroup"
            accessibilityLabel={strings.settings.audioOutput}
            className="gap-one rounded-lg border border-border-strong bg-surface-elevated p-two">
            {OPTIONS.map((option) => {
              const selected = output === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={option.label}
                  accessibilityHint={option.hint}
                  onPress={() => choose(option.value)}
                  className={`min-h-touch flex-row items-center gap-three rounded-md px-three active:opacity-85 ${
                    selected ? 'bg-primary' : ''
                  }`}>
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={selected ? theme.onPrimary : theme.primary}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <ThemedText
                    type="smallBold"
                    themeColor={selected ? 'onPrimary' : 'text'}
                    className="flex-1">
                    {option.label}
                  </ThemedText>
                  {selected && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={theme.onPrimary}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}
