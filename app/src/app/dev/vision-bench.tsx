/**
 * Pantalla de desarrollo: mide la latencia de un modelo de visión en la nube leyendo el cartel
 * de un ómnibus (paso 2 de la reunión con el tutor, 2026-08-10).
 *
 * Es una ruta suelta, no una pestaña: no debe aparecer en la barra de navegación del producto.
 * El enlace desde Ajustes aparece con `__DEV__` o con una clave de proveedor cargada.
 */
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useVisionBenchmark } from '@/features/benchmark/useVisionBenchmark';
import { strings } from '@/i18n';
import { availableModels, formatBytes, formatMs, isVisionConfigured, summarize } from '@/services/vision';
import type { LatencyMetric } from '@/services/vision';

const METRICS: { key: LatencyMetric; label: string }[] = [
  { key: 'toHeaders', label: strings.benchmark.metricToHeaders },
  { key: 'toFirstByte', label: strings.benchmark.metricToFirstByte },
  { key: 'toFirstEvent', label: strings.benchmark.metricToFirstEvent },
  { key: 'toFirstTextDelta', label: strings.benchmark.metricToFirstTextDelta },
  { key: 'total', label: strings.benchmark.metricTotal },
];

const RUN_COUNT = 6;

export default function VisionBenchScreen() {
  const t = strings.benchmark;
  const { state, pickPhoto, setModel, setThinking, run, cancel } = useVisionBenchmark();

  const isBusy = state.status === 'warmup' || state.status === 'running';
  const lastRun = state.runs[state.runs.length - 1];

  // `accessibilityLiveRegion` es SÓLO Android. Sin esto, en iPhone un usuario de VoiceOver no
  // escucha ningún cambio de estado — y esta pantalla es, entera, una máquina de estados.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(state.message);
  }, [state.message]);

  return (
    <>
      {/*
        Sin título en el header nativo: `ScreenHeader` ya lo anuncia como encabezado y duplicarlo
        hace que VoiceOver lo lea dos veces. `headerBackTitle` sí hace falta: sin él, iOS usa el
        título de la ruta anterior, que es el nombre interno del grupo — "(tabs)".
      */}
      <Stack.Screen
        options={{ headerShown: true, title: '', headerBackTitle: strings.common.back }}
      />
      {/* El header nativo ya cubre el notch: sin `edges` el safe area se aplicaría dos veces. */}
      <Screen scroll edges={[]}>
        <ScreenHeader title={t.title} subtitle={t.intro} />

        {!isVisionConfigured && (
          <Card>
            <ThemedText type="default" themeColor="danger">
              {t.notConfigured}
            </ThemedText>
          </Card>
        )}

        <Card>
          <SectionLabel>{t.photoSection}</SectionLabel>
          {state.photo ? (
            <View
              style={styles.photoRow}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${t.photoSelected}. ${state.photo.width} por ${state.photo.height} píxeles. ${t.payloadLabel}: ${formatBytes(state.photo.base64.length)}.`}>
              <Image
                source={{ uri: state.photo.uri }}
                style={styles.thumbnail}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.photoMeta}>
                <ThemedText type="small" themeColor="textSecondary">
                  {state.photo.width} × {state.photo.height} px
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t.payloadLabel}: {formatBytes(state.photo.base64.length)}
                </ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText type="default" themeColor="textSecondary">
              {t.noPhoto}
            </ThemedText>
          )}
          <AccessibleButton
            label={t.pickPhoto}
            hint={t.pickPhotoHint}
            variant="secondary"
            disabled={isBusy}
            onPress={pickPhoto}
          />
        </Card>

        <Card>
          <SectionLabel>{t.configSection}</SectionLabel>
          <AccessibleButton
            label={state.model.label}
            hint={t.modelHint}
            variant="ghost"
            disabled={isBusy || availableModels().length < 2}
            onPress={setModel}
          />
          {state.model.supportsAdaptiveThinking ? (
            <AccessibleButton
              label={state.thinking === 'off' ? t.thinkingOff : t.thinkingAdaptive}
              hint={t.thinkingLabel}
              variant="ghost"
              disabled={isBusy}
              onPress={() => setThinking(state.thinking === 'off' ? 'adaptive' : 'off')}
            />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t.thinkingUnsupported}
            </ThemedText>
          )}
        </Card>

        <View
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={state.message}>
          <ThemedText type="small" themeColor={state.status === 'error' ? 'danger' : 'textSecondary'}>
            {state.message}
          </ThemedText>
        </View>

        {/*
          Un solo botón que cambia de rol, no dos que se montan y desmontan: si el elemento
          enfocado desaparece al activarlo, VoiceOver pierde el foco y salta al tope de la pantalla.
        */}
        <AccessibleButton
          label={isBusy ? t.cancelButton : `${t.runButton} ${RUN_COUNT} ${t.runsLabel}`}
          hint={isBusy ? t.cancelHint : t.runHint}
          variant={isBusy ? 'danger' : 'primary'}
          disabled={!isBusy && (!state.photo || !isVisionConfigured)}
          onPress={isBusy ? cancel : () => run(RUN_COUNT)}
        />

        {state.runs.length > 0 && (
          <Card>
            <SectionLabel>{t.resultsSection}</SectionLabel>
            {METRICS.map(({ key, label }) => {
              const summary = summarize(state.runs, key);
              return (
                <View
                  key={key}
                  style={styles.metricRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${label}. ${t.medianLabel} ${formatMs(summary.medianMs)}. ${t.p90Label} ${formatMs(summary.p90Ms)}. ${summary.samples} ${t.samplesLabel}.`}>
                  <ThemedText type="small" style={styles.metricLabel}>
                    {label}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {t.medianLabel} {formatMs(summary.medianMs)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t.p90Label} {formatMs(summary.p90Ms)}
                  </ThemedText>
                </View>
              );
            })}
            <ThemedText type="small" themeColor="textSecondary">
              {`${t.medianLabel} · ${t.p90Label} — ${state.runs.length} ${t.samplesLabel}`}
            </ThemedText>
          </Card>
        )}

        {lastRun && (
          <Card>
            <SectionLabel>{t.readingSection}</SectionLabel>
            {lastRun.parsed ? (
              <>
                <ThemedText type="default">
                  {t.readingLine}: {lastRun.parsed.numero ?? '—'}
                </ThemedText>
                <ThemedText type="default">
                  {t.readingName}: {lastRun.parsed.nombre ?? '—'}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="default" themeColor="danger">
                {t.readingUnparsed}
              </ThemedText>
            )}
            {lastRun.usage && (
              <ThemedText type="small" themeColor="textSecondary">
                {t.tokensLabel}: {lastRun.usage.input_tokens} in / {lastRun.usage.output_tokens} out
              </ThemedText>
            )}
          </Card>
        )}
      </Screen>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
      {children.toUpperCase()}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
  },
  photoMeta: {
    flex: 1,
    gap: 2,
  },
  // Columna, no fila: con Dynamic Type grande una fila de 3 columnas aplasta los números
  // contra el borde mientras la etiqueta se parte en varias líneas.
  metricRow: {
    gap: 2,
  },
  metricLabel: {
    flex: 1,
  },
});
