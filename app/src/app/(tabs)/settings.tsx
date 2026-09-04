import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { ModelSelector } from '@/features/reader/ModelSelector';
import { useModeloSupermercado } from '@/features/reader/ModeloSupermercadoProvider';
import { ThemeSelector } from '@/features/theme/ThemeSelector';
import { strings } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}) {
  const theme = useTheme();
  return (
    <View
      className="flex-row items-center gap-three"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${desc}`}>
      {/* Relleno verde con el glifo oscuro encima, no al revés: el verde de marca sobre su
          propio tinte claro da 2.24:1 y un ícono necesita 3:1 (WCAG 1.4.11). */}
      <View className="h-[44px] w-[44px] items-center justify-center rounded-md bg-primary">
        <Ionicons name={icon} size={24} color={theme.onPrimary} />
      </View>
      <View className="flex-1 gap-[2px]">
        <ThemedText type="default" className="font-sans-bold">
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {desc}
        </ThemedText>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const t = strings.settings;
  const { modelo, modelos, elegir } = useModeloSupermercado();

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.appearance.toUpperCase()}
        </ThemedText>
        <ThemeSelector />
      </Card>

      {/* Sin rótulo alrededor a pedido: el disparador ya se anuncia como "Modelo seleccionado: X"
          y el menú como "Seleccionar modelo". Sin ninguna clave en el build no hay nada que elegir
          y se dice, porque un control ausente no comunica estado. */}
      <Card>
        {modelo ? (
          <ModelSelector value={modelo} options={modelos} onChange={elegir} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {strings.reader.cloudNotConfigured}
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {strings.home.howItWorks.toUpperCase()}
        </ThemedText>
        <FeatureRow icon="bus" title={strings.home.useBus} desc={strings.home.useBusDesc} />
        <FeatureRow
          icon="cart"
          title={strings.home.useProduct}
          desc={strings.home.useProductDesc}
        />
        <AccessibleButton
          label={strings.home.testAudioButton}
          hint={strings.home.testAudioHint}
          variant="secondary"
          onPress={() => announce(strings.home.testAudioPhrase)}
        />
      </Card>

    </Screen>
  );
}
