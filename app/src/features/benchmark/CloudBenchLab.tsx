/**
 * El benchmark de latencia en la nube, como componente embebible (antes, pantalla de desarrollo).
 *
 * Vive en Inicio junto al resto del laboratorio mientras dure la etapa de prueba: el equipo está
 * comparando caminos desde la pantalla real. Mide TTFT y latencia total contra el proveedor
 * configurado (paso 2 de la reunión con el tutor, 2026-08-10).
 *
 * `accessibilityLiveRegion` es sólo Android: los cambios de estado se anuncian con
 * `announceForAccessibility`, porque esta sección es, entera, una máquina de estados.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useVisionBenchmark } from '@/features/benchmark/useVisionBenchmark';
import { strings } from '@/i18n';
import {
  availableModels,
  formatBytes,
  formatMs,
  isVisionConfigured,
  summarize,
} from '@/services/vision';
import type { LatencyMetric } from '@/services/vision';

const METRICS: { key: LatencyMetric; label: string }[] = [
  { key: 'toHeaders', label: strings.benchmark.metricToHeaders },
  { key: 'toFirstByte', label: strings.benchmark.metricToFirstByte },
  { key: 'toFirstEvent', label: strings.benchmark.metricToFirstEvent },
  { key: 'toFirstTextDelta', label: strings.benchmark.metricToFirstTextDelta },
  { key: 'total', label: strings.benchmark.metricTotal },
];

/**
 * Corridas por medición. Con el calentamiento son RUN_COUNT + 1 llamadas, y el tier gratuito de
 * Gemini admite 20 por minuto: 4 corridas dejan entrar cuatro mediciones por minuto en vez de dos.
 */
const RUN_COUNT = 4;

/** Debajo de esto el p90 es simplemente el máximo, así que se rotula como tal. */
const MUESTRAS_PARA_P90 = 8;

export function CloudBenchLab() {
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
      <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
        {t.title.toUpperCase()}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.intro}
      </ThemedText>

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
              className="flex-row items-center gap-three"
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${t.photoSelected}. ${state.photo.width} por ${state.photo.height} píxeles. ${t.payloadLabel}: ${formatBytes(state.photo.base64.length)}.`}>
              <Image
                source={{ uri: state.photo.uri }}
                className="h-[72px] w-[72px] rounded-md"
                accessibilityIgnoresInvertColors
              />
              <View className="flex-1 gap-[2px]">
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
              // Con pocas muestras el p90 coincide con el máximo: mentiría llamarlo percentil.
              const usaP90 = summary.samples >= MUESTRAS_PARA_P90;
              const segundoLabel = usaP90 ? t.p90Label : t.maxLabel;
              const segundoValor = usaP90 ? summary.p90Ms : summary.maxMs;
              return (
                <View
                  key={key}
                  // Columna, no fila: con Dynamic Type grande una fila de 3 columnas aplasta
                  // los números contra el borde y parte la etiqueta en varias líneas.
                  className="gap-[2px]"
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${label}. ${t.medianLabel} ${formatMs(summary.medianMs)}. ${segundoLabel} ${formatMs(segundoValor)}. ${summary.samples} ${t.samplesLabel}.`}>
                  <ThemedText type="small" className="flex-1">
                    {label}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {t.medianLabel} {formatMs(summary.medianMs)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {segundoLabel} {formatMs(segundoValor)}
                  </ThemedText>
                </View>
              );
            })}
            <ThemedText type="small" themeColor="textSecondary">
              {`${state.runs.length} ${t.samplesLabel}${
                state.runs.length < MUESTRAS_PARA_P90 ? ` — ${t.fewSamples}` : ''
              }`}
            </ThemedText>
          </Card>
        )}

        {lastRun && (
          <Card>
            <SectionLabel>{t.readingSection}</SectionLabel>
            {lastRun.parsed ? (
              <>
                <ThemedText type="default" themeColor="success" style={{ fontFamily: Fonts.sansBold }}>
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
