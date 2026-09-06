/**
 * Inicio: los modos de operación (ADR 0007) al frente.
 *
 * Los dos botones de modo son la versión de desarrollo del botón físico del dispositivo:
 * aplican los mismos gestos (click, doble click, click largo) a la misma máquina de estados.
 * Cada botón muta entre activar y desactivar en lugar de intercambiarse por otro — si el botón
 * cambiara de identidad, VoiceOver perdería el foco (trampa ya pisada, ver convenciones).
 * El botón del modo contrario se deshabilita porque el diagrama canónico no tiene salto directo
 * entre modos: se pasa por esperando, acá y en el firmware.
 */
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { formatMs } from '@/features/reader/lectura';
import type { Modo } from '@/features/reader/modes';
import { filasDeLinea, filasDeProducto } from '@/features/reader/resultado';
import { useLector } from '@/features/reader/useLector';
import { strings } from '@/i18n';

const MODO_LABEL: Record<Modo, string> = {
  esperando: strings.reader.modeEsperando,
  omnibus: strings.reader.modeOmnibus,
  supermercado: strings.reader.modeSupermercado,
};

const READ_HINT: Record<Modo, string> = {
  esperando: strings.reader.readHintEsperando,
  omnibus: strings.reader.readHintBus,
  supermercado: strings.reader.readHintSuper,
};

export default function HomeScreen() {
  const t = strings.home;
  const r = strings.reader;
  const { state, aplicarGesto, leer, modelo, fotoDesdeLaPlaca } = useLector();

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

        {/* Con la placa conectada y con red, la foto la saca ELLA (ADR 0003): es el flujo real del
            dispositivo. La cámara del teléfono queda como alternativa debajo, no desaparece. */}
        <AccessibleButton
          label={
            state.estado === 'preparing' && state.progreso != null
              ? `${r.reading} ${Math.round(state.progreso * 100)} %`
              : state.estado === 'reading'
                ? r.reading
                : fotoDesdeLaPlaca
                  ? r.readWithDeviceButton
                  : r.readButton
          }
          hint={fotoDesdeLaPlaca ? r.readWithDeviceHint : READ_HINT[state.modo]}
          onPress={() => leer(fotoDesdeLaPlaca ? 'placa' : 'camara')}
          disabled={ocupado || state.modo === 'esperando'}
          loading={ocupado}
        />
        {fotoDesdeLaPlaca && (
          <AccessibleButton
            label={r.readButton}
            hint={READ_HINT[state.modo]}
            variant="secondary"
            onPress={() => leer('camara')}
            disabled={ocupado || state.modo === 'esperando'}
          />
        )}
        {/* La fototeca es la segunda fuente, no la principal: existe para poder pasarle la MISMA
            foto a varios modelos y que la comparación mida modelos y no fotos (ADR 0006). Va
            debajo de la acción principal para que el lector de pantalla llegue primero a la que
            el usuario quiere el 99 % de las veces, y es además la salida cuando el permiso de
            cámara quedó denegado — por eso no se esconde. */}
        <AccessibleButton
          label={r.galleryButton}
          hint={r.galleryHint}
          variant="secondary"
          onPress={() => leer('fototeca')}
          disabled={ocupado || state.modo === 'esperando'}
        />

        {/* La voz ya dijo la frase; la pantalla muestra los campos uno por uno, legibles y
            recorribles con el lector de pantalla. El texto crudo del modelo sólo aparece cuando no
            hubo lectura estructurada (o en ómnibus, donde es lo que detectó el OCR). */}
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
        {state.textoCrudo && (state.modo === 'omnibus' || !filas) && (
          <View accessible accessibilityRole="text">
            <ThemedText type="small" themeColor="textSecondary">
              {r.rawLabel}
            </ThemedText>
            <ThemedText type="code">{state.textoCrudo.slice(0, 200)}</ThemedText>
          </View>
        )}
        {state.modelo && (
          <View accessible accessibilityRole="text">
            <ThemedText type="small" themeColor="textSecondary">
              {r.modelUsedLabel}
            </ThemedText>
            <ThemedText type="code">{state.modelo}</ThemedText>
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
        {/* Sólo aparece con la síntesis a archivo habilitada, que está apagada por defecto. Es la
            única forma de comprobar que el .mp3 se escribió sin reproducirlo — reproducirlo diría
            la lectura dos veces. */}
        {state.audio && (
          <View accessible accessibilityRole="text">
            <ThemedText type="small" themeColor="textSecondary">
              {r.audioLabel}
            </ThemedText>
            <ThemedText type="code">{state.audio}</ThemedText>
          </View>
        )}
      </Card>

    </Screen>
  );
}
