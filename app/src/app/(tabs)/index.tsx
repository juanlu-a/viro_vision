/**
 * Inicio: la acción principal de la app —leer un cartel— al frente.
 *
 * El lector estuvo en una pantalla de desarrollo mientras fue un experimento; una vez que el
 * spike validó los caminos (`docs/spike-vision-local.md`), esconderlo detrás de Ajustes era
 * hacerle pedir permiso al usuario para usar la app. Los caminos se mantienen elegibles a
 * propósito: la decisión de cuál queda es del equipo, y compararlos desde la pantalla real es
 * parte del experimento. Ajustes vuelve a ser sólo configuración.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { CloudBenchLab } from '@/features/benchmark/CloudBenchLab';
import { OnDeviceLab } from '@/features/ondevice/OnDeviceLab';
import { useLector } from '@/features/reader/useLector';
import { strings } from '@/i18n';
import { isOnDeviceSpikeEnabled } from '@/services/ondevice';
import { loadUserName } from '@/services/storage/userName';
import { formatMs, isVisionConfigured } from '@/services/vision';

const CAMINO_LABEL = {
  ocr: strings.reader.pathOcr,
  vlm: strings.reader.pathVlm,
  nube: strings.reader.pathCloud,
} as const;

export default function HomeScreen() {
  const t = strings.home;
  const r = strings.reader;
  const { state, rotarCamino, leer } = useLector();
  const [nombre, setNombre] = useState('');

  // Alcanza con leerlo al montar: la pestaña de Inicio se monta una vez por sesión y cambiar el
  // nombre es un evento raro — el saludo nuevo aparece en el próximo arranque.
  useEffect(() => {
    loadUserName().then(setNombre);
  }, []);

  const ocupado = state.estado !== 'idle';
  const saludo = nombre ? `${t.greeting}, ${nombre}. ${t.subtitle}` : t.subtitle;

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} subtitle={saludo} mark="large" />

      {/* La acción principal: primera en la pantalla y primera para el lector de pantalla. */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {r.section.toUpperCase()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {r.intro}
        </ThemedText>
        <AccessibleButton
          label={`${r.pathLabel}: ${CAMINO_LABEL[state.camino]}`}
          hint={r.pathHint}
          variant="secondary"
          onPress={rotarCamino}
          disabled={ocupado}
        />
        <AccessibleButton
          label={
            state.estado === 'preparing' && state.progreso != null
              ? `${r.reading} ${Math.round(state.progreso * 100)} %`
              : state.estado === 'reading'
                ? r.reading
                : r.readButton
          }
          hint={r.readHint}
          onPress={leer}
          disabled={ocupado}
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
        {state.ms != null && (
          <View accessible accessibilityRole="text">
            <ThemedText type="small" themeColor="textSecondary">
              {r.timeLabel}
            </ThemedText>
            <ThemedText type="code">{formatMs(state.ms)}</ThemedText>
          </View>
        )}
      </Card>

      {/* El laboratorio completo del spike, en Inicio a pedido del equipo mientras dure la
          etapa de prueba: la elección definitiva de flujo no está tomada, y compararlo desde la
          pantalla real es parte del experimento. Gateado por la misma variable de siempre. */}
      {isOnDeviceSpikeEnabled && <OnDeviceLab />}

      {/* El benchmark de nube cierra el laboratorio: mismo gate de siempre — la clave, no
          __DEV__, para poder medir en la calle con un build de Release. */}
      {(__DEV__ || isVisionConfigured) && (
        <Card>
          <CloudBenchLab />
        </Card>
      )}
    </Screen>
  );
}
