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
import { useEffect, useState } from 'react';
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
import { loadUserName } from '@/services/storage/userName';

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
  const [nombre, setNombre] = useState('');

  // Alcanza con leerlo al montar: la pestaña de Inicio se monta una vez por sesión y cambiar el
  // nombre es un evento raro — el saludo nuevo aparece en el próximo arranque.
  useEffect(() => {
    loadUserName().then(setNombre);
  }, []);

  const ocupado = state.estado !== 'idle';
  const enOmnibus = state.modo === 'omnibus';
  const enSupermercado = state.modo === 'supermercado';
  const saludo = nombre ? `${t.greeting}, ${nombre}. ${t.subtitle}` : t.subtitle;

  return (
    <Screen scroll onRefresh={async () => setNombre(await loadUserName())}>
      <ScreenHeader title={t.title} subtitle={saludo} mark="large" />

      {/* La acción principal: primera en la pantalla y primera para el lector de pantalla. */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {r.section.toUpperCase()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {r.intro}
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
        {/* El modelo de nube del modo supermercado, siempre visible (el orden de foco no cambia
            con el modo). Sin clave no hay selector: se dice antes de que el usuario lo descubra
            eligiendo una foto — el estado nunca se comunica sólo por un botón deshabilitado. */}
        {modelo ? (
          <ModelSelector value={modelo} options={modelos} onChange={elegirModelo} disabled={ocupado} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {r.cloudNotConfigured}
          </ThemedText>
        )}

        <AccessibleButton
          label={
            state.estado === 'preparing' && state.progreso != null
              ? `${r.reading} ${Math.round(state.progreso * 100)} %`
              : state.estado === 'reading'
                ? r.reading
                : r.readButton
          }
          hint={READ_HINT[state.modo]}
          onPress={leer}
          disabled={ocupado || state.modo === 'esperando'}
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
