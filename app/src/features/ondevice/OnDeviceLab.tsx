/**
 * El laboratorio del spike de visión local (ADR 0004): todos los caminos, con todas las perillas.
 *
 * Es un componente y no una pantalla porque el usuario lo quiso **en Inicio** mientras dure la
 * etapa de prueba: la elección definitiva de flujo todavía no está tomada, y compararlos desde la
 * pantalla real es parte del experimento. Cuando el equipo decida un camino, esto se reduce o
 * vuelve a una pantalla de desarrollo — es deliberadamente fácil de mover.
 *
 * Todo mensaje se anuncia con `announceForAccessibility`: `accessibilityLiveRegion` es sólo
 * Android, así que en iPhone no anunciaría nada.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useOnDeviceSpike } from '@/features/ondevice/useOnDeviceSpike';
import { strings } from '@/i18n';
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

export function OnDeviceLab() {
  const {
    state,
    elegirArchivo,
    rotarRemoto,
    descargar,
    prepararOcr,
    leerConOcr,
    etPreparar,
    etLeerImagen,
    setBackend,
    setMultimodal,
    setPrecision,
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
  const { carga, diagnostico, generacion } = state;

  return (
    <>

        {/* La contraprueba del spike: el mismo Gemma 4, por el runtime de Apple (MLX) en vez
            del delegado Metal de LiteRT. Responde si la visión falla por la librería o por el
            teléfono. */}
        <Card>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {t.etSection.toUpperCase()}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.etIntro}
          </ThemedText>
          <AccessibleButton
            label={
              state.progreso == null || state.estado !== 'loading'
                ? t.etPrepare
                : `${t.etLoading} ${Math.round(state.progreso * 100)} %`
            }
            hint={t.etPrepareHint}
            variant="secondary"
            onPress={etPreparar}
            disabled={ocupado}
          />
          <AccessibleButton
            label={t.etRead}
            hint={t.etReadHint}
            onPress={etLeerImagen}
            disabled={ocupado || state.etCargaMs == null}
          />
          {state.etCargaMs != null && <Fila label={t.etLoadTime} value={formatMs(state.etCargaMs)} />}
          {state.etGeneracion && (
            <View className="gap-three">
              <Fila
                label={t.ttft}
                value={state.etGeneracion.ttftMs == null ? '—' : formatMs(state.etGeneracion.ttftMs)}
              />
              <Fila label={t.totalTime} value={formatMs(state.etGeneracion.totalMs)} />
              {state.etLectura && (
                <Fila
                  label={t.parsed}
                  value={`${state.etLectura.numero ?? '—'} · ${state.etLectura.nombre ?? '—'}`}
                />
              )}
              <Fila label={t.rawText} value={state.etGeneracion.texto.slice(0, 400)} />
            </View>
          )}
        </Card>

        {/* El OCR va primero porque es el camino más barato: ~250 MB de modelos entrenados
            contra los 3 GB de un multimodal, y hace exactamente la tarea —leer texto de una
            foto— en vez de hacerla como caso particular de entender la escena. */}
        <Card>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {t.ocrSection.toUpperCase()}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.ocrIntro}
          </ThemedText>
          <AccessibleButton
            label={t.ocrPrepare}
            hint={t.ocrPrepareHint}
            variant="secondary"
            onPress={prepararOcr}
            disabled={ocupado}
          />
          <AccessibleButton
            label={t.ocrRead}
            hint={t.ocrReadHint}
            onPress={leerConOcr}
            disabled={ocupado}
          />
          {state.ocrCargaMs != null && (
            <Fila label={t.ocrLoadTime} value={formatMs(state.ocrCargaMs)} />
          )}
          {state.ocr && (
            <View className="gap-three">
              <Fila label={t.ocrReadTime} value={formatMs(state.ocr.ms)} />
              <Fila
                label={t.ocrDetections}
                value={
                  state.ocr.detecciones.length === 0
                    ? t.ocrNone
                    : state.ocr.detecciones
                        .slice(0, 8)
                        .map((d) => `${d.text} (${Math.round(d.score * 100)} %)`)
                        .join('\n')
                }
              />
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
    </>
  );
}
