/**
 * Selector of the cloud model for supermarket mode: a one-line trigger that opens a modal, traced
 * from `features/theme/ThemeSelector.tsx` — same reason (a dropdown does not inflate the screen) and
 * the same accessible grammar: the trigger is a `button` whose label already says which model is in
 * force, and the menu is a `radiogroup` with `checked`.
 *
 * Unlike the theme one, it is **controlled by props**: it knows nothing about storage or where the
 * models come from, so what decides (ProductModelProvider and its resolver) is tested without UI.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';
import { getProvider } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

const t = strings.reader;

type Props = {
  value: ModelProfile;
  options: readonly ModelProfile[];
  onChange: (id: string) => void;
  disabled?: boolean;
};

export function ModelSelector({ value, options, onChange, disabled = false }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const choose = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.modelLabel}: ${value.label}`}
        accessibilityHint={t.modelHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={`min-h-touch flex-row items-center gap-two rounded-md border border-border-strong bg-surface-elevated px-three active:opacity-85 ${
          disabled ? 'opacity-50' : ''
        }`}>
        <Ionicons
          name="cloud"
          size={20}
          color={theme.primary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <ThemedText type="smallBold" className="flex-1">
          {value.label}
        </ThemedText>
        <Ionicons
          name="chevron-down"
          size={18}
          color={theme.textSecondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* The backdrop closes on tap but is hidden from the screen reader: with VoiceOver the
            closing gesture is the system's, and a full-screen "button" only gets in the way. */}
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
            accessibilityLabel={t.modelSelect}
            className="gap-one rounded-lg border border-border-strong bg-surface-elevated p-two">
            {options.map((option) => {
              const selected = option.id === value.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={option.label}
                  accessibilityHint={`${t.modelProvider}: ${getProvider(option.provider).label}`}
                  onPress={() => choose(option.id)}
                  className={`min-h-touch flex-row items-center gap-three rounded-md px-three active:opacity-85 ${
                    selected ? 'bg-primary' : ''
                  }`}>
                  <ThemedText
                    type="smallBold"
                    themeColor={selected ? 'onPrimary' : 'text'}
                    className="flex-1">
                    {option.label}
                  </ThemedText>
                  {/* The check is reinforcement: the fill changes and `checked` is what the reader announces. */}
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
