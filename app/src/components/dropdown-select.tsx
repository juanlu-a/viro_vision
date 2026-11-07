/**
 * A one-line trigger that opens a modal menu: the dropdown behind the model and app-mode choices.
 *
 * Extracted from `ModelSelector` when the app-mode choice became a dropdown too, so the
 * two cannot drift apart in how they sound. The accessible grammar is the one `ModelSelector` had:
 * the trigger is a `button` whose label already says what is in force ("Modelo seleccionado: X"),
 * and the menu is a `radiogroup` whose options carry `checked`. A dropdown and not inline options
 * because it does not inflate the screen, and the trigger says the current value without opening it.
 *
 * Controlled by props: it knows nothing about storage or what the options mean. Picking the option
 * already in force still reaches `onChange` (the model's provider persists that as a choice); whether
 * a re-pick is a no-op is the caller's call.
 *
 * `onChange` runs in the same tick as the tap, so the trigger already holds the new value when the
 * modal closes and the screen reader lands back on it. A spoken confirmation is the caller's, and it
 * should wait for the modal to close (`AppModeSelector` does).
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Read by the screen reader on the option, inside the menu. */
  hint?: string;
}

type Props<T extends string> = {
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Prefix of the trigger's spoken label: "<label>: <current option>". */
  label: string;
  /** The trigger's hint: what choosing here changes. */
  hint: string;
  /** The menu's name for the screen reader. */
  menuLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
};

export function DropdownSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  hint,
  menuLabel,
  icon,
  disabled = false,
}: Props<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  const choose = (next: T) => {
    setOpen(false);
    if (next !== value) Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? value}`}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={`min-h-touch flex-row items-center gap-two rounded-md border border-border-strong bg-surface-elevated px-three active:opacity-85 ${
          disabled ? 'opacity-50' : ''
        }`}>
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={theme.primary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
        <ThemedText type="smallBold" className="flex-1">
          {current?.label ?? value}
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
            accessibilityLabel={menuLabel}
            className="gap-one rounded-lg border border-border-strong bg-surface-elevated p-two">
            {options.map((option) => {
              const selected = option.value === value;
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
