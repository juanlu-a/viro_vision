/**
 * Selector de tema: sistema / claro / oscuro.
 *
 * Se expone como un grupo de radios y no como tres botones sueltos: para un lector de pantalla,
 * `radiogroup` + `checked` comunica que son opciones excluyentes y cuál está activa. Tres botones
 * sin estado sólo dirían "botón", sin decir cuál rige.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { A11y, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';
import type { ThemePreference } from '@/services/storage/themePreference';

import { useThemePreference } from './ThemePreferenceProvider';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  {
    value: 'system',
    label: strings.settings.themeSystem,
    hint: strings.settings.themeSystemHint,
  },
  { value: 'light', label: strings.settings.themeLight, hint: strings.settings.themeLightHint },
  { value: 'dark', label: strings.settings.themeDark, hint: strings.settings.themeDarkHint },
];

export function ThemeSelector() {
  const { preference, setPreference } = useThemePreference();
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.settings.appearance}
      accessibilityHint={strings.settings.appearanceHint}
      style={styles.group}>
      {OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => {
              Haptics.selectionAsync();
              setPreference(option.value);
            }}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected ? theme.primary : theme.surfaceElevated,
                // El estado seleccionado no se comunica sólo por color: también cambia el grosor
                // del borde, para quien no distingue el relleno.
                borderColor: selected ? theme.primary : theme.borderStrong,
                borderWidth: selected ? 3 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText
              type="default"
              style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  option: {
    minHeight: A11y.minTouchTarget,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.sansBold,
  },
});
