/**
 * Pantalla de la sonda del runtime local (ADR 0004).
 *
 * REGLA DE FRONTERA (ADR 0001): herramienta de desarrollo. Va detrás de `__DEV__` a secas, no del
 * gate de claves que usa el benchmark de nube — acá no hay clave de API que gatear.
 *
 * Todo lo que se muestra se anuncia además por `announceForAccessibility`: `accessibilityLiveRegion`
 * es sólo Android, así que en iPhone —el equipo objetivo hoy— no anunciaría nada.
 */
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n';
import { GEMMA_4_E2B_BYTES, sondearRuntime } from '@/services/ondevice';
import type { ResultadoSonda } from '@/services/ondevice';
import { formatBytes } from '@/services/vision';

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
  const [estado, setEstado] = useState<'idle' | 'probing' | 'done'>('idle');
  const [resultado, setResultado] = useState<ResultadoSonda | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const mensaje =
    estado === 'probing'
      ? t.probing
      : !resultado
        ? t.idle
        : resultado.error
          ? `${t.error}: ${resultado.error}`
          : t.nativeOk;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(mensaje);
  }, [mensaje]);

  const sondear = useCallback(async () => {
    setEstado('probing');
    const r = await sondearRuntime();
    if (!vivo.current) return;
    setResultado(r);
    setEstado('done');
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: strings.common.back }} />
      <Screen scroll>
        <ScreenHeader title={t.title} subtitle={t.intro} />

        <Card>
          <AccessibleButton
            label={estado === 'probing' ? t.probing : t.probeButton}
            hint={t.probeHint}
            onPress={sondear}
            loading={estado === 'probing'}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {mensaje}
          </ThemedText>
        </Card>

        {resultado && !resultado.error && (
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
                {t.title.toUpperCase()}
              </ThemedText>
              <View style={styles.filas}>
                <Fila
                  label={t.availableMemory}
                  value={
                    resultado.memoriaDisponibleBytes == null
                      ? '—'
                      : formatBytes(resultado.memoriaDisponibleBytes)
                  }
                />
                <Fila label={t.modelSize} value={formatBytes(GEMMA_4_E2B_BYTES)} />
                <Fila label={t.recommendedBackend} value={resultado.backendRecomendado ?? '—'} />
                {resultado.avisoBackend && (
                  <Fila label={t.backendWarning} value={resultado.avisoBackend} />
                )}
                <Fila
                  label={t.multimodalBlocked}
                  value={resultado.bloqueoMultimodal ?? t.multimodalOk}
                />
              </View>
            </Card>

            {resultado.estimaciones.map((e) => (
              <Card key={e.backend}>
                <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
                  {`${t.estimates} — ${e.label}`.toUpperCase()}
                </ThemedText>
                {e.error || !e.estimacion ? (
                  <ThemedText type="small" themeColor="danger">
                    {e.error ?? t.error}
                  </ThemedText>
                ) : (
                  <View style={styles.filas}>
                    <Fila label={t.estimateModel} value={formatBytes(e.estimacion.modelBytes)} />
                    <Fila label={t.estimateKv} value={formatBytes(e.estimacion.kvCacheBytes)} />
                    <Fila
                      label={t.estimateOverhead}
                      value={formatBytes(e.estimacion.overheadBytes)}
                    />
                    <Fila
                      label={t.estimateTotal}
                      value={formatBytes(e.estimacion.totalEstimatedBytes)}
                    />
                    <Fila
                      label={t.estimateHeadroom}
                      value={formatBytes(e.estimacion.headroomBytes)}
                    />
                    {/* El veredicto va como TEXTO, no como color: es la conclusión de la pantalla
                        y quien la lee con VoiceOver tiene que recibirla igual que quien la ve. */}
                    <ThemedText
                      type="default"
                      themeColor={e.estimacion.verdict === 'critical' ? 'danger' : 'success'}>
                      {e.estimacion.verdict === 'safe'
                        ? t.verdictSafe
                        : e.estimacion.verdict === 'tight'
                          ? t.verdictTight
                          : t.verdictCritical}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {e.estimacion.recommendation}
                    </ThemedText>
                  </View>
                )}
              </Card>
            ))}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  filas: {
    gap: Spacing.three,
  },
});
