/**
 * Pantalla del spike de inferencia local (ADR 0004).
 *
 * REGLA DE FRONTERA (ADR 0001): herramienta de desarrollo. Va detrás de `__DEV__` a secas, no del
 * gate de claves que usa el benchmark de nube — acá no hay clave de API que gatear.
 *
 * El orden de la pantalla es el orden del experimento, del corte más barato al más caro: sondear
 * (no carga nada) → elegir archivo → cargar → generar. Cada paso sólo se habilita si el anterior
 * salió bien, para que un fallo se atribuya al paso correcto.
 *
 * Todo mensaje se anuncia con `announceForAccessibility`: `accessibilityLiveRegion` es sólo
 * Android, así que en iPhone —el equipo objetivo hoy— no anunciaría nada.
 */
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useOnDeviceSpike } from '@/features/ondevice/useOnDeviceSpike';
import { strings } from '@/i18n';
import { GEMMA_4_E2B_BYTES } from '@/services/ondevice';
import { formatBytes, formatMs } from '@/services/vision';

const t = strings.ondevice;

function Fila({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="code">{value}</ThemedText>
    </View>
  );
}

export default function OnDeviceBenchScreen() {
  const {
    state,
    sondear,
    elegirArchivo,
    setBackend,
    setMultimodal,
    cargar,
    liberar,
    probarTexto,
    probarImagen,
  } = useOnDeviceSpike();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(state.mensaje);
  }, [state.mensaje]);

  const ocupado = state.estado !== 'idle';
  const { sonda, carga, generacion } = state;

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: '', headerBackTitle: strings.common.back }}
      />
      {/* `edges={[]}`: el header nativo ya cubre el inset de arriba. */}
      <Screen scroll edges={[]}>
        <ScreenHeader title={t.title} subtitle={t.intro} />

        <Card>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {t.estimates.toUpperCase()}
          </ThemedText>
          <AccessibleButton
            label={state.estado === 'probing' ? t.probing : t.probeButton}
            hint={t.probeHint}
            variant="secondary"
            onPress={sondear}
            disabled={ocupado}
          />
          {sonda && !sonda.error && (
            <View className="gap-three">
              <Fila
                label={t.availableMemory}
                value={
                  sonda.memoriaDisponibleBytes == null
                    ? '—'
                    : formatBytes(sonda.memoriaDisponibleBytes)
                }
              />
              <Fila label={t.recommendedBackend} value={sonda.backendRecomendado ?? '—'} />
              <Fila label={t.multimodalBlocked} value={sonda.bloqueoMultimodal ?? t.multimodalOk} />
              {sonda.estimaciones.map((e) =>
                e.estimacion ? (
                  <Fila
                    key={e.backend}
                    label={`${e.label} · ${formatBytes(GEMMA_4_E2B_BYTES)}`}
                    value={`${formatBytes(e.estimacion.totalEstimatedBytes)} — ${
                      e.estimacion.verdict === 'safe'
                        ? t.verdictSafe
                        : e.estimacion.verdict === 'tight'
                          ? t.verdictTight
                          : t.verdictCritical
                    }`}
                  />
                ) : null,
              )}
            </View>
          )}
        </Card>

        <Card>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {t.modelSection.toUpperCase()}
          </ThemedText>
          <AccessibleButton
            label={t.pickModel}
            hint={t.pickModelHint}
            variant="secondary"
            onPress={elegirArchivo}
            disabled={ocupado}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {state.archivo?.nombre ?? t.noModelPicked}
          </ThemedText>

          {/* Backend y multimodal como botones que rotan, no como interruptores: el estado va en
              la etiqueta, así que VoiceOver lo lee sin depender de un `accessibilityState` que en
              un control propio hay que acordarse de mantener. */}
          <AccessibleButton
            label={`${t.backendSection}: ${state.backend}`}
            hint={t.backendHint}
            variant="secondary"
            onPress={() => setBackend(state.backend === 'cpu' ? 'gpu' : 'cpu')}
            disabled={ocupado}
          />
          <AccessibleButton
            label={`${t.multimodalLabel}: ${state.multimodal ? t.yes : t.no}`}
            hint={t.multimodalHint}
            variant="secondary"
            onPress={() => setMultimodal(!state.multimodal)}
            disabled={ocupado}
          />
        </Card>

        <Card>
          <AccessibleButton
            label={state.estado === 'loading' ? t.loading : t.loadModel}
            hint={t.loadModelHint}
            onPress={cargar}
            disabled={ocupado || !state.archivo}
            loading={state.estado === 'loading'}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {state.mensaje}
          </ThemedText>

          {carga && (
            <View className="gap-three">
              <Fila label={t.loadTime} value={formatMs(carga.cargaMs)} />
              <Fila
                label={t.memoryAfter}
                value={
                  carga.memoriaDespuesBytes == null ? '—' : formatBytes(carga.memoriaDespuesBytes)
                }
              />
              <AccessibleButton
                label={t.unload}
                hint={t.unloadHint}
                variant="secondary"
                onPress={liberar}
                disabled={ocupado}
              />
            </View>
          )}
        </Card>

        {carga && (
          <Card>
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
              {t.result.toUpperCase()}
            </ThemedText>
            <AccessibleButton
              label={t.runText}
              hint={t.runTextHint}
              variant="secondary"
              onPress={probarTexto}
              disabled={ocupado}
            />
            <AccessibleButton
              label={t.runImage}
              hint={t.runImageHint}
              onPress={probarImagen}
              disabled={ocupado || !state.multimodal}
            />

            {generacion && (
              <View className="gap-three">
                <Fila
                  label={t.ttft}
                  value={
                    generacion.stats ? formatMs(generacion.stats.timeToFirstToken) : '—'
                  }
                />
                <Fila label={t.totalTime} value={formatMs(generacion.totalMs)} />
                <Fila
                  label={t.tokensPerSecond}
                  value={
                    generacion.stats ? generacion.stats.tokensPerSecond.toFixed(1) : '—'
                  }
                />
                {state.lectura && (
                  <Fila
                    label={t.parsed}
                    value={`${state.lectura.numero ?? '—'} · ${state.lectura.nombre ?? '—'}`}
                  />
                )}
                <Fila label={t.rawText} value={generacion.texto.slice(0, 400)} />
              </View>
            )}
          </Card>
        )}
      </Screen>
    </>
  );
}
