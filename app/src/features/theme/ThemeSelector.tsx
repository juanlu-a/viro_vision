/**
 * Selector de tema: sistema / claro / oscuro.
 *
 * Es un desplegable compacto y no tres bloques apilados. El motivo no es estético: ocupando media
 * pantalla, la apariencia parecía el ajuste más importante de la app, y no lo es. Un disparador de
 * una línea le da el peso que tiene.
 *
 * Para el lector de pantalla nada se pierde: el disparador es un `button` cuya etiqueta ya dice qué
 * opción rige ("Apariencia: Oscuro"), y el menú que abre es un `radiogroup` con `checked`, que es
 * lo que comunica que las opciones son excluyentes. Los íconos son decorativos y van ocultos — el
 * texto no depende de ellos.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { A11y, Fonts, Radius, Spacing } from '@/constants/theme';
import { useSurfaces } from '@/hooks/use-surfaces';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';
import type { ThemePreference } from '@/services/storage/themePreference';

import { useThemePreference } from './ThemePreferenceProvider';

type Opcion = {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: Opcion[] = [
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
  const theme = useTheme();
  const surfaces = useSurfaces();
  const [abierto, setAbierto] = useState(false);

  const actual = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];

  const elegir = (value: ThemePreference) => {
    Haptics.selectionAsync().catch(() => {});
    setPreference(value);
    setAbierto(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${strings.settings.appearance}: ${actual.label}`}
        accessibilityHint={strings.settings.appearanceHint}
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [surfaces.control, styles.trigger, { opacity: pressed ? 0.85 : 1 }]}>
        <Ionicons
          name={actual.icon}
          size={20}
          color={theme.primary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <ThemedText type="small" style={styles.triggerLabel}>
          {actual.label}
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
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}>
        {/* El fondo cierra al tocarlo, pero se oculta del lector de pantalla: con VoiceOver el
            gesto de cerrar es el propio del sistema, y un "botón" que ocupa toda la pantalla sólo
            estorbaría al recorrer las opciones. */}
        <Pressable
          style={surfaces.overlay}
          onPress={() => setAbierto(false)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.centro} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            accessibilityRole="radiogroup"
            accessibilityLabel={strings.settings.appearance}
            style={[surfaces.panelElevated, styles.menu]}>
            {OPTIONS.map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={option.label}
                  accessibilityHint={option.hint}
                  onPress={() => elegir(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? theme.primary : 'transparent',
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={selected ? theme.onPrimary : theme.primary}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <ThemedText
                    type="small"
                    style={[
                      styles.optionLabel,
                      { color: selected ? theme.onPrimary : theme.text },
                    ]}>
                    {option.label}
                  </ThemedText>
                  {/* El check es refuerzo del estado, no su único portador: el relleno cambia y
                      `accessibilityState.checked` es lo que anuncia el lector. */}
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

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  triggerLabel: {
    flex: 1,
    fontFamily: Fonts.sansBold,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  menu: {
    padding: Spacing.two,
    gap: Spacing.one,
  },
  option: {
    minHeight: A11y.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  optionLabel: {
    flex: 1,
    fontFamily: Fonts.sansBold,
  },
});
