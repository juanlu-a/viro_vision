/**
 * Theme selector: system / light / dark.
 *
 * It is a compact dropdown and not three stacked blocks. The reason is not aesthetic: taking up half
 * the screen, appearance looked like the app's most important setting, and it is not. A one-line
 * trigger gives it the weight it has.
 *
 * Nothing is lost for the screen reader: the trigger is a `button` whose label already says which
 * option is in force ("Apariencia: Oscuro"), and the menu it opens is a `radiogroup` with `checked`,
 * which is what communicates that the options are mutually exclusive. The icons are decorative and
 * hidden — the text does not depend on them.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';
import type { ThemePreference } from '@/services/storage/themePreference';

import { useThemePreference } from './ThemePreferenceProvider';

type Option = {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: Option[] = [
  {
    value: 'system',
    label: strings.settings.themeSystem,
    hint: strings.settings.themeSystemHint,
    icon: 'phone-portrait',
  },
  {
    value: 'light',
    label: strings.settings.themeLight,
    hint: strings.settings.themeLightHint,
    icon: 'sunny',
  },
  {
    value: 'dark',
    label: strings.settings.themeDark,
    hint: strings.settings.themeDarkHint,
    icon: 'moon',
  },
];

export function ThemeSelector() {
  const { preference, setPreference } = useThemePreference();
  // `theme` is still needed: an icon's colour is a prop, not a style.
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];

  const choose = (value: ThemePreference) => {
    Haptics.selectionAsync().catch(() => {});
    setPreference(value);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${strings.settings.appearance}: ${current.label}`}
        accessibilityHint={strings.settings.appearanceHint}
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        {/* The backdrop closes on tap, but it is hidden from the screen reader: with VoiceOver the
            closing gesture is the system's own, and a full-screen "button" would only get in the way
            when walking the options. */}
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
            accessibilityLabel={strings.settings.appearance}
            className="gap-one rounded-lg border border-border-strong bg-surface-elevated p-two">
            {OPTIONS.map((option) => {
              const selected = preference === option.value;
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
                  {/* The check reinforces the state, it is not its only carrier: the fill changes
                      and `accessibilityState.checked` is what the reader announces. */}
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
