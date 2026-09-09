/**
 * Inicio: los modos de operación (ADR 0007) al frente.
 *
 * Los dos botones de modo son la versión de desarrollo del botón físico del dispositivo:
 * aplican los mismos gestos (click, doble click, click largo) a la misma máquina de estados.
 * Cada botón muta entre activar y desactivar en lugar de intercambiarse por otro — si el botón
 * cambiara de identidad, VoiceOver perdería el foco (trampa ya pisada, ver convenciones).
 * El botón del modo contrario se deshabilita porque el diagrama canónico no tiene salto directo
 * entre modos: se pasa por esperando, acá y en el firmware.
 *
 * La pantalla muestra el RESULTADO y nada más. Los tiempos, el modelo que respondió, el texto crudo
 * del OCR y la foto que sacó la placa se registran en Supabase desde el 2026-09-07: eran una
 * pantalla de diagnóstico incrustada en la interfaz de una app para personas que no la ven.
 */
import { ActivityIndicator, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import type { Modo } from '@/features/reader/modes';
import { filasDeLinea, filasDeProducto } from '@/features/reader/resultado';
import { useLector } from '@/features/reader/useLector';
import { strings } from '@/i18n';

const MODO_LABEL: Record<Modo, string> = {
  esperando: strings.reader.modeEsperando,
  omnibus: strings.reader.modeOmnibus,
  supermercado: strings.reader.modeSupermercado,
};

export default function HomeScreen() {
  const t = strings.home;
  const r = strings.reader;
  const { state, aplicarGesto, leer, modelo, placaLista, estadoPlaca } = useLector();
  const textoPlaca = {
    lista: r.deviceReady,
    conectando: r.deviceConnecting,
    error: r.deviceNetworkError,
    'sin-red': r.deviceNoNetwork,
    buscando: r.deviceSearching,
    'sin-placa': r.deviceAbsent,
  }[estadoPlaca];

  const ocupado = state.estado !== 'idle';
  const filas = state.producto ? filasDeProducto(state.producto) : state.lectura ? filasDeLinea(state.lectura) : null;
  const enOmnibus = state.modo === 'omnibus';
  const enSupermercado = state.modo === 'supermercado';

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} subtitle={t.subtitle} mark="large" />

      {/* La acción principal: primera en la pantalla y primera para el lector de pantalla. */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {r.section.toUpperCase()}
        </ThemedText>

        {/* El dispositivo, en una línea y siempre: desde que la app abre, la placa se conecta y se
            une a su red sola; esta línea muestra ese progreso para que "todavía no" no parezca "no
            anda". Es una live region: el lector de pantalla anuncia los cambios. Y desde que la
            placa es la única cámara, es además lo que explica por qué leer puede estar apagado. */}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${r.deviceStatusLabel}: ${textoPlaca}`}
          className="flex-row items-center gap-two">
          {estadoPlaca === 'conectando' || estadoPlaca === 'buscando' ? <ActivityIndicator size="small" /> : null}
          <ThemedText type="small" themeColor={estadoPlaca === 'lista' ? 'success' : estadoPlaca === 'error' ? 'danger' : 'textSecondary'}>
            {r.deviceStatusLabel}: {textoPlaca}
          </ThemedText>
        </View>

        {/* El modo también como texto: el estado nunca se comunica sólo por botones o color. */}
        <View accessible accessibilityRole="text" accessibilityLabel={`${r.modeLabel}: ${MODO_LABEL[state.modo]}`}>
          <ThemedText type="small" themeColor="textSecondary">
            {r.modeLabel}
          </ThemedText>
          <ThemedText type="subtitle">{MODO_LABEL[state.modo]}</ThemedText>
        </View>

        <AccessibleButton
          label={enOmnibus ? r.modeBusOff : r.modeBusOn}
          hint={enSupermercado ? r.modeBlockedHint : enOmnibus ? r.modeOffHint : r.modeBusOnHint}
          variant="secondary"
          onPress={() => aplicarGesto(enOmnibus ? 'clickLargo' : 'click')}
          disabled={ocupado || enSupermercado}
        />
        <AccessibleButton
          label={enSupermercado ? r.modeSuperOff : r.modeSuperOn}
          hint={enOmnibus ? r.modeBlockedHint : enSupermercado ? r.modeOffHint : r.modeSuperOnHint}
          variant="secondary"
          onPress={() => aplicarGesto(enSupermercado ? 'clickLargo' : 'dobleClick')}
          disabled={ocupado || enOmnibus}
        />
        {/* Elegir el modelo es un ajuste y vive en Ajustes; acá queda sólo el aviso de que este
            build no trae ninguna clave, y sólo con el modo que la necesita activo. Se dice antes de
            leer en vez de dejar que el usuario lo descubra al sacar la foto: el estado nunca se
            comunica sólo por un control ausente. */}
        {enSupermercado && !modelo && (
          <ThemedText type="small" themeColor="textSecondary">
            {r.cloudNotConfigured}
          </ThemedText>
        )}

        {/* Un solo botón de leer, y la foto la saca SIEMPRE la placa (ADR 0003). Sin ella no hay
            imagen, así que se deshabilita en vez de esconderse —un control ausente no comunica
            estado— y el hint dice qué falta: la línea de arriba dice en qué anda el dispositivo,
            ésta dice qué hacer al respecto. El botón muta y no se intercambia por otro, para que
            VoiceOver no pierda el foco al cambiar de estado. */}
        <AccessibleButton
          label={
            state.estado === 'preparing' && state.progreso != null
              ? `${r.reading} ${Math.round(state.progreso * 100)} %`
              : state.estado === 'reading'
                ? r.reading
                : r.readWithDeviceButton
          }
          hint={placaLista ? r.readWithDeviceHint : r.readNeedsDeviceHint}
          onPress={leer}
          disabled={ocupado || state.modo === 'esperando' || !placaLista}
          loading={ocupado}
        />

        {/* La voz ya dijo la frase; la pantalla muestra los campos uno por uno, legibles y
            recorribles con el lector de pantalla. */}
        {state.mensaje !== '' && !filas && (
          <View accessible accessibilityRole="text" accessibilityLabel={state.mensaje}>
            <ThemedText type="small" themeColor="textSecondary">
              {r.resultLabel}
            </ThemedText>
            <ThemedText type="subtitle">{state.mensaje}</ThemedText>
          </View>
        )}
        {filas && (
          <View className="gap-two">
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
              {r.resultLabel.toUpperCase()}
            </ThemedText>
            {filas.map((f) => (
              <View
                key={f.etiqueta}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${f.etiqueta}: ${f.valor}`}
                className="flex-row items-baseline justify-between gap-three">
                <ThemedText type="small" themeColor="textSecondary">
                  {f.etiqueta}
                </ThemedText>
                <ThemedText type={f.vacio ? 'small' : 'subtitle'} themeColor={f.vacio ? 'textSecondary' : undefined} className="flex-1 text-right">
                  {f.valor}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </Card>

    </Screen>
  );
}
