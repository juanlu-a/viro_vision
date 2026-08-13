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
    rotarRemoto,
    descargar,
    setBackend,
    setMultimodal,
    setPrecision,
    setJsonEstricto,
    rotarContexto,
    cargar,
    liberar,
    limpiar,
    probarTexto,
    probarImagen,
  } = useOnDeviceSpike();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(state.mensaje);
  }, [state.mensaje]);

  const ocupado = state.estado !== 'idle';
  const { sonda, carga, diagnostico, generacion } = state;

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
          {/* Descargar desde la app garantiza la variante correcta: las `-gpu` y `-web` de Gemma
              no traen codificador de visión y no pueden leer un cartel. */}
          <AccessibleButton
            label={`${t.remoteModel}: ${state.remoto.label} (${formatBytes(state.remoto.bytes)})`}
            hint={t.remoteModelHint}
            variant="secondary"
            onPress={rotarRemoto}
            disabled={ocupado}
          />
          {/* El aviso va **antes** de bajar un archivo de gigabytes: la RAM que pide la visión no
              se deduce del tamaño, y el estimador de la librería no la modela. */}
          {state.remoto.ramMinimaBytes != null &&
            state.sonda?.memoriaDisponibleBytes != null &&
            state.sonda.memoriaDisponibleBytes < state.remoto.ramMinimaBytes && (
              <ThemedText type="small" themeColor="danger">
                {`${t.ramWarning} ${formatBytes(state.remoto.ramMinimaBytes)}. ${t.availableMemory}: ${formatBytes(state.sonda.memoriaDisponibleBytes)}.`}
              </ThemedText>
            )}
          <AccessibleButton
            label={
              state.progreso == null
                ? t.download
                : `${t.downloading} ${Math.round(state.progreso * 100)} %`
            }
            hint={t.downloadHint}
            onPress={descargar}
            disabled={ocupado}
            loading={state.progreso != null}
          />
          {state.descargaMs != null && (
            <Fila label={t.downloadTime} value={formatMs(state.descargaMs)} />
          )}

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

          {/* Sin esto no hay salida desde la app: las copias se acumulan en la caché y, con el
              disco lleno, cargar aborta el proceso sin decir por qué. */}
          <AccessibleButton
            label={t.cleanCopies}
            hint={t.cleanCopiesHint}
            variant="secondary"
            onPress={limpiar}
            disabled={ocupado}
          />

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
            label={`${t.strictJson}: ${state.jsonEstricto ? t.yes : t.no}`}
            hint={t.strictJsonHint}
            variant="secondary"
            onPress={() => setJsonEstricto(!state.jsonEstricto)}
            disabled={ocupado}
          />
          <AccessibleButton
            label={`${t.contextLabel}: ${state.contexto}`}
            hint={t.contextHint}
            variant="secondary"
            onPress={rotarContexto}
            disabled={ocupado}
          />
          <AccessibleButton
            label={`${t.precisionLabel}: ${state.precision}`}
            hint={t.precisionHint}
            variant="secondary"
            onPress={() => setPrecision(state.precision === 'f16' ? 'f32' : 'f16')}
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

          {/* El diagnóstico se muestra aunque la carga falle: ahí es donde sirve. Un archivo más
              chico que el original significa copia truncada; un veredicto crítico, falta de
              memoria. La librería usa el mismo mensaje de error para las dos cosas. */}
          {diagnostico && (
            <View className="gap-three">
              <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
                {t.diagnosis.toUpperCase()}
              </ThemedText>
              <Fila
                label={t.fileSize}
                value={
                  diagnostico.archivoBytes == null ? '—' : formatBytes(diagnostico.archivoBytes)
                }
              />
              <Fila
                label={t.diskFree}
                value={
                  diagnostico.discoLibreBytes == null
                    ? '—'
                    : formatBytes(diagnostico.discoLibreBytes)
                }
              />
              <Fila
                label={t.availableMemory}
                value={
                  diagnostico.memoriaDisponibleBytes == null
                    ? '—'
                    : formatBytes(diagnostico.memoriaDisponibleBytes)
                }
              />
              <Fila label={t.verdict} value={diagnostico.veredicto ?? '—'} />
              {diagnostico.detalle && (
                <ThemedText type="small" themeColor="textSecondary">
                  {diagnostico.detalle}
                </ThemedText>
              )}
            </View>
          )}

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
              // Habilitado siempre que haya modelo cargado, aunque no se haya marcado multimodal:
              // un botón deshabilitado no explica nada, y el error del runtime dice más que
              // nuestra suposición sobre si el modelo acepta imagen.
              disabled={ocupado}
            />

            {generacion && (
              <View className="gap-three">
                {/* El TTFT medido sobre el primer token **del stream**, igual que el benchmark
                    de nube. El que reporta el runtime nativo va aparte: si difieren mucho, el
                    costo está en el puente JS y eso también es un dato. */}
                <Fila
                  label={t.ttft}
                  value={generacion.ttftMs == null ? '—' : formatMs(generacion.ttftMs)}
                />
                <Fila
                  label={t.ttftNative}
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
