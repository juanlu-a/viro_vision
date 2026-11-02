/**
 * Product mode or development mode, in Settings.
 *
 * A `radiogroup` of two named modes and not a `Switch`, for the reason `AudioOutputSelector` gives:
 * "modo desarrollo, desactivado" does not say which mode is in force. Inline and not in a modal: two
 * options do not need a menu, and every extra step is one more for someone walking it by ear. The
 * choice is spoken, because nothing else confirms it to someone who does not see Home change.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { strings } from '@/i18n';
import type { AppMode } from '@/services/storage/appModePreference';

import { useAppMode } from './AppModeProvider';

const t = strings.settings;

const OPTIONS: { value: AppMode; label: string; hint: string }[] = [
  { value: 'product', label: t.appModeProduct, hint: t.appModeProductHint },
  { value: 'development', label: t.appModeDevelopment, hint: t.appModeDevelopmentHint },
];

export function AppModeSelector() {
  const { mode, setMode } = useAppMode();

  const choose = (value: AppMode) => {
    if (value === mode) return;
    Haptics.selectionAsync().catch(() => {});
    setMode(value);
    void announce(value === 'development' ? t.appModeSetToDevelopment : t.appModeSetToProduct);
  };

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t.appMode} className="gap-one">
      {OPTIONS.map((option) => {
        const selected = mode === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => choose(option.value)}
            className={`min-h-touch flex-row items-center rounded-md border border-border-strong px-three active:opacity-85 ${
              selected ? 'bg-primary' : 'bg-surface-elevated'
            }`}>
            <ThemedText type="smallBold" themeColor={selected ? 'onPrimary' : 'text'} className="flex-1">
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
