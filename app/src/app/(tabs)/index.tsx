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
import { ModelSelector } from '@/features/reader/ModelSelector';
import type { Modo } from '@/features/reader/modes';
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
  const { state, aplicarGesto, leer, modelo, modelos, elegirModelo } = useLector();

  const ocupado = state.estado !== 'idle';
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
        {/* El modelo de nube pertenece al modo supermercado y sólo aparece con ese modo activo:
            es el único que va a la nube (ADR 0006), y en los otros modos el control no hace nada.
            Aparece justo debajo del botón que lo habilita, así el foco de VoiceOver lo encuentra
            en el siguiente elemento tras activar el modo. Sin clave no hay selector: se dice acá
            en vez de dejar que el usuario lo descubra recién al elegir una foto — el estado nunca
            se comunica sólo por un control ausente. */}
        {enSupermercado &&
          (modelo ? (
            <ModelSelector value={modelo} options={modelos} onChange={elegirModelo} disabled={ocupado} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {r.cloudNotConfigured}
            </ThemedText>
          ))}

        <AccessibleButton
          label={
            state.estado === 'preparing' && state.progreso != null
              ? `${r.reading} ${Math.round(state.progreso * 100)} %`
              : state.estado === 'reading'
                ? r.reading
                : r.readButton
          }
          hint={READ_HINT[state.modo]}
          onPress={() => leer('camara')}
          disabled={ocupado || state.modo === 'esperando'}
          loading={ocupado}
        />
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
      </Card>

    </Screen>
  );
}
