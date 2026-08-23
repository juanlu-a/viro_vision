import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { ThemeSelector } from '@/features/theme/ThemeSelector';
import { strings } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { loadUserName, saveUserName } from '@/services/storage/userName';

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
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    loadUserName().then(setNombre);
  }, []);

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.appearance.toUpperCase()}
        </ThemedText>
        <ThemeSelector />
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.nameSection.toUpperCase()}
        </ThemedText>
        {/* Se guarda al escribir, sin botón: un "Guardar" es un paso más para recorrer con el
            lector de pantalla y no protege nada — el dato es un saludo. */}
        <TextField
          label={t.nameLabel}
          hint={t.nameHint}
          placeholder={t.namePlaceholder}
          value={nombre}
          autoComplete="name"
          onChangeText={(v) => {
            setNombre(v);
            void saveUserName(v);
          }}
        />
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

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.about.toUpperCase()}
        </ThemedText>
        <ThemedText type="default" className="font-sans-bold">
          {strings.app.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {strings.app.tagline}
        </ThemedText>
      </Card>

    </Screen>
  );
}
