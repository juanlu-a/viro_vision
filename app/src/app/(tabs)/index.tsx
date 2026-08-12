import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { announce } from '@/features/audio/announcer';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';

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
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={`${title}. ${desc}`}>
      {/* Relleno verde con el glifo oscuro encima, no al revés: el verde de marca sobre su
          propio tinte claro da 2.24:1 y un ícono necesita 3:1 (WCAG 1.4.11). Además es lo que
          más verde pone en pantalla, que es el peso que el manual le asigna. */}
      <View style={[styles.iconWrap, { backgroundColor: theme.primary }]}>
        <Ionicons name={icon} size={24} color={theme.onPrimary} />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="default" style={styles.rowTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {desc}
        </ThemedText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const t = strings.home;
  return (
    <Screen>
      <ScreenHeader title={t.title} subtitle={t.subtitle} mark="large" />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.howItWorks.toUpperCase()}
        </ThemedText>
        <FeatureRow icon="bus" title={t.useBus} desc={t.useBusDesc} />
        <FeatureRow icon="cart" title={t.useProduct} desc={t.useProductDesc} />
      </Card>

      <AccessibleButton
        label={t.testAudioButton}
        hint={t.testAudioHint}
        onPress={() => announce(t.testAudioPhrase)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: Fonts.sansBold,
  },
});
