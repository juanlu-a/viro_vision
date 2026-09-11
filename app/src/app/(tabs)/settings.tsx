import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { AudioOutputSelector } from '@/features/audio/AudioOutputSelector';
import { ModelSelector } from '@/features/reader/ModelSelector';
import { useProductModel } from '@/features/reader/ProductModelProvider';
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
      {/* Green fill with the dark glyph on top, not the other way round: the brand green over its
          own light tint gives 2.24:1 and an icon needs 3:1 (WCAG 1.4.11). */}
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
  const { model, models, choose } = useProductModel();

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.appearance.toUpperCase()}
        </ThemedText>
        <ThemeSelector />
      </Card>

      {/* No surrounding label, by request: the trigger already announces itself as "Modelo
          seleccionado: X" and the menu as "Seleccionar modelo". With no key in the build there is
          nothing to choose and it says so, because an absent control communicates no state. */}
      <Card>
        {model ? (
          <ModelSelector value={model} options={models} onChange={choose} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {strings.reader.cloudNotConfigured}
          </ThemedText>
        )}
      </Card>

      {/* Above "cómo funciona" and below the model: it is a decision about the reading, like the
          model, and not part of the explanation of the app. */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.audioOutput.toUpperCase()}
        </ThemedText>
        <AudioOutputSelector />
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
