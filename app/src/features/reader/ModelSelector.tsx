/**
 * Selector del modelo de nube para el modo supermercado: un disparador de una línea que abre un
 * modal, calcado de `features/theme/ThemeSelector.tsx` — mismo motivo (un desplegable no infla la
 * pantalla) y misma gramática accesible: el disparador es un `button` cuya etiqueta ya dice qué
 * modelo rige, y el menú es un `radiogroup` con `checked`.
 *
 * A diferencia del de tema, es **controlado por props**: no sabe de storage ni de dónde salen los
 * modelos, así lo que decide (ModeloSupermercadoProvider y su resolver) se testea sin UI.
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
  const [abierto, setAbierto] = useState(false);

  const elegir = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(id);
    setAbierto(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.modelLabel}: ${value.label}`}
        accessibilityHint={t.modelHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setAbierto(true)}
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

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        {/* El fondo cierra al tocarlo pero se oculta del lector: con VoiceOver el gesto de cerrar
            es el del sistema, y un "botón" de pantalla completa sólo estorba al recorrer. */}
        <Pressable
          className="absolute inset-0 bg-overlay"
          onPress={() => setAbierto(false)}
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
                  onPress={() => elegir(option.id)}
                  className={`min-h-touch flex-row items-center gap-three rounded-md px-three active:opacity-85 ${
                    selected ? 'bg-primary' : ''
                  }`}>
                  <ThemedText
                    type="smallBold"
                    themeColor={selected ? 'onPrimary' : 'text'}
                    className="flex-1">
                    {option.label}
                  </ThemedText>
                  {/* El check es refuerzo: el relleno cambia y `checked` es lo que anuncia el lector. */}
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
