/**
 * Inicio: la acción principal de la app —leer un cartel— al frente.
 *
 * El lector estuvo en una pantalla de desarrollo mientras fue un experimento; una vez que el
 * spike validó los caminos (`docs/spike-vision-local.md`), esconderlo detrás de Ajustes era
 * hacerle pedir permiso al usuario para usar la app. Los caminos se mantienen elegibles a
 * propósito: la decisión de cuál queda es del equipo, y compararlos desde la pantalla real es
 * parte del experimento. Ajustes vuelve a ser sólo configuración.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { useLector } from '@/features/reader/useLector';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n';
import { loadUserName } from '@/services/storage/userName';
import { formatMs } from '@/services/vision';

const CAMINO_LABEL = {
  ocr: strings.reader.pathOcr,
  vlm: strings.reader.pathVlm,
  nube: strings.reader.pathCloud,
} as const;

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

export default function HomeScreen() {
  const t = strings.home;
  const r = strings.reader;
  const { state, rotarCamino, leer } = useLector();
  const [nombre, setNombre] = useState('');

  // Alcanza con leerlo al montar: la pestaña de Inicio se monta una vez por sesión y cambiar el
  // nombre es un evento raro — el saludo nuevo aparece en el próximo arranque.
  useEffect(() => {
    loadUserName().then(setNombre);
  }, []);

  const ocupado = state.estado !== 'idle';
  const saludo = nombre ? `${t.greeting}, ${nombre}. ${t.subtitle}` : t.subtitle;

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} subtitle={saludo} mark="large" />

      {/* La acción principal: primera en la pantalla y primera para el lector de pantalla. */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {r.section.toUpperCase()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {r.intro}
        </ThemedText>
        <AccessibleButton
          label={`${r.pathLabel}: ${CAMINO_LABEL[state.camino]}`}
          hint={r.pathHint}
          variant="secondary"
          onPress={rotarCamino}
          disabled={ocupado}
        />
        <AccessibleButton
          label={
            state.estado === 'preparing' && state.progreso != null
              ? `${r.reading} ${Math.round(state.progreso * 100)} %`
              : state.estado === 'reading'
                ? r.reading
                : r.readButton
          }
          hint={r.readHint}
          onPress={leer}
          disabled={ocupado}
          loading={ocupado}
        />

        {state.mensaje !== '' && (
          <View accessible accessibilityRole="text" accessibilityLabel={state.mensaje}>
            <ThemedText type="small" themeColor="textSecondary">
              {r.resultLabel}
            </ThemedText>
            <ThemedText type="subtitle">{state.mensaje}</ThemedText>
          </View>
        )}
        {state.textoCrudo && (
          <View accessible accessibilityRole="text">
            <ThemedText type="small" themeColor="textSecondary">
              {r.rawLabel}
            </ThemedText>
            <ThemedText type="code">{state.textoCrudo.slice(0, 200)}</ThemedText>
          </View>
        )}
        {state.ms != null && (
          <View accessible accessibilityRole="text">
            <ThemedText type="small" themeColor="textSecondary">
              {r.timeLabel}
            </ThemedText>
            <ThemedText type="code">{formatMs(state.ms)}</ThemedText>
          </View>
        )}
      </Card>

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
        variant="secondary"
        onPress={() => announce(t.testAudioPhrase)}
      />
    </Screen>
  );
}
