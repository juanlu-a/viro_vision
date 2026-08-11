import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
      {/* Verde: en el manual es "estado confirmado", y esto es lo que la app ya sabe reconocer. */}
      <View style={[styles.iconWrap, { backgroundColor: theme.successMuted }]}>
        <Ionicons name={icon} size={22} color={theme.success} />
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
      {/*
        El símbolo de marca. Es la forma más fiel de traer el verde a la app: en el manual el verde
        es el arco derecho del símbolo, no un color de interfaz. Decorativo para el lector de
        pantalla — el nombre de la app ya lo dice el encabezado de abajo.
      */}
      <Image
        source={require('@/../assets/images/splash-icon.png')}
        style={styles.mark}
        contentFit="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <ScreenHeader title={t.title} subtitle={t.subtitle} />

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
  mark: {
    width: 84,
    height: 84,
  },
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
    fontWeight: '600',
  },
});
