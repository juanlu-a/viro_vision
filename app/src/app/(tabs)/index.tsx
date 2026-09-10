/**
 * Home: the operating modes (ADR 0007) up front.
 *
 * The two mode buttons are the development version of the device's physical button: they apply the
 * same gestures (click, double click, long press) to the same state machine. Each button mutates
 * between activate and deactivate instead of being swapped for another one — if a button changed
 * identity, VoiceOver would lose focus (a trap already stepped on, see the conventions).
 *
 * Neither is disabled by the other's mode: since ADR 0007's 2026-09-09 update a gesture names a
 * mode from wherever the device is, and the firmware honours that. Until 2026-10 this screen still
 * blocked the direct jump and said so in a hint, so the app was stricter than the device it mirrors
 * — the exact drift `modes.test.ts` exists to catch, and it slipped through because the guard lived
 * in a screen and not in the machine.
 *
 * The screen shows the RESULT and the photo behind it, nothing else. The timings, which model
 * answered and the OCR's raw text are recorded in Supabase since 2026-09-07: they were a
 * diagnostics screen embedded in the interface of an app for people who do not see it.
 */
import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import type { Mode } from '@/features/reader/modes';
import { busLineRows, productRows } from '@/features/reader/result';
import { useReader } from '@/features/reader/useReader';
import { strings } from '@/i18n';

const MODE_LABEL: Record<Mode, string> = {
  idle: strings.reader.modeIdle,
  bus: strings.reader.modeBus,
  supermarket: strings.reader.modeSupermarket,
};

export default function HomeScreen() {
  const t = strings.home;
  const r = strings.reader;
  const { state, applyGesture, read, model, deviceReady, deviceState } = useReader();
  const deviceText = {
    ready: r.deviceReady,
    connecting: r.deviceConnecting,
    error: r.deviceNetworkError,
    'no-network': r.deviceNoNetwork,
    searching: r.deviceSearching,
    'no-device': r.deviceAbsent,
  }[deviceState];

  const busy = state.status !== 'idle';
  const rows = state.product ? productRows(state.product) : state.reading ? busLineRows(state.reading) : null;
  const inBus = state.mode === 'bus';
  const inSupermarket = state.mode === 'supermarket';

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} subtitle={t.subtitle} mark="large" />

      {/* The main action: first on the screen and first for the screen reader. */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {r.section.toUpperCase()}
        </ThemedText>

        {/* The device, in one line and always: from the moment the app opens, the device connects
            and joins its network on its own; this line shows that progress so that "not yet" does
            not look like "it does not work". It is a live region: the screen reader announces the
            changes. And since the device is the only camera, it is also what explains why reading
            may be switched off. */}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${r.deviceStatusLabel}: ${deviceText}`}
          className="flex-row items-center gap-two">
          {deviceState === 'connecting' || deviceState === 'searching' ? <ActivityIndicator size="small" /> : null}
          <ThemedText type="small" themeColor={deviceState === 'ready' ? 'success' : deviceState === 'error' ? 'danger' : 'textSecondary'}>
            {r.deviceStatusLabel}: {deviceText}
          </ThemedText>
        </View>

        {/* The mode as text too: state is never communicated by buttons or colour alone. */}
        <View accessible accessibilityRole="text" accessibilityLabel={`${r.modeLabel}: ${MODE_LABEL[state.mode]}`}>
          <ThemedText type="small" themeColor="textSecondary">
            {r.modeLabel}
          </ThemedText>
          <ThemedText type="subtitle">{MODE_LABEL[state.mode]}</ThemedText>
        </View>

        <AccessibleButton
          label={inBus ? r.modeBusOff : r.modeBusOn}
          hint={inBus ? r.modeOffHint : r.modeBusOnHint}
          variant="secondary"
          onPress={() => applyGesture(inBus ? 'longPress' : 'click')}
          disabled={busy}
        />
        <AccessibleButton
          label={inSupermarket ? r.modeSuperOff : r.modeSuperOn}
          hint={inSupermarket ? r.modeOffHint : r.modeSuperOnHint}
          variant="secondary"
          onPress={() => applyGesture(inSupermarket ? 'longPress' : 'doubleClick')}
          disabled={busy}
        />
        {/* Choosing the model is a setting and lives in Settings; what stays here is only the notice
            that this build ships no key, and only with the mode that needs it active. It is said
            before reading instead of letting the user discover it when taking the photo: state is
            never communicated by an absent control alone. */}
        {inSupermarket && !model && (
          <ThemedText type="small" themeColor="textSecondary">
            {r.cloudNotConfigured}
          </ThemedText>
        )}

        {/* A single read button, and the photo is ALWAYS taken by the device (ADR 0003). Without it
            there is no image, so it is disabled instead of hidden —an absent control communicates no
            state— and the hint says what is missing: the line above says what the device is doing,
            this one says what to do about it. The button mutates and is not swapped for another one,
            so VoiceOver does not lose focus when the state changes. */}
        <AccessibleButton
          label={
            state.status === 'preparing' && state.progress != null
              ? `${r.reading} ${Math.round(state.progress * 100)} %`
              : state.status === 'reading'
                ? r.reading
                : r.readWithDeviceButton
          }
          hint={deviceReady ? r.readWithDeviceHint : r.readNeedsDeviceHint}
          onPress={read}
          disabled={busy || state.mode === 'idle' || !deviceReady}
          loading={busy}
        />

        {/* The voice already said the phrase; the screen shows the fields one by one, readable and
            walkable with the screen reader. */}
        {state.message !== '' && !rows && (
          <View accessible accessibilityRole="text" accessibilityLabel={state.message}>
            <ThemedText type="small" themeColor="textSecondary">
              {r.resultLabel}
            </ThemedText>
            <ThemedText type="subtitle">{state.message}</ThemedText>
          </View>
        )}
        {rows && (
          <View className="gap-two">
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
              {r.resultLabel.toUpperCase()}
            </ThemedText>
            {rows.map((row) => (
              <View
                key={row.label}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${row.label}: ${row.value}`}
                className="flex-row items-baseline justify-between gap-three">
                <ThemedText type="small" themeColor="textSecondary">
                  {row.label}
                </ThemedText>
                <ThemedText type={row.empty ? 'small' : 'subtitle'} themeColor={row.empty ? 'textSecondary' : undefined} className="flex-1 text-right">
                  {row.value}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* La foto que sacó el dispositivo, debajo del resultado. No es diagnóstico —de eso se
            encarga la telemetría— sino el contenido del producto: quien tiene algo de visión la usa
            para ver qué encuadró la cámara, que es lo único que distingue «el modelo se equivocó» de
            «la foto era del techo». Va DESPUÉS de los campos a propósito: la voz ya dijo el
            resultado y el lector de pantalla llega primero a lo que se puede leer.

            `aspect-ratio` fijo en 4:3, que es lo que entrega la placa (1024x766): sin él la altura la
            decidiría la imagen al cargar y la tarjeta saltaría. */}
        {state.photoUri && (
          <View className="gap-two">
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
              {r.photoLabel.toUpperCase()}
            </ThemedText>
            <Image
              source={{ uri: state.photoUri }}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md }}
              contentFit="contain"
              accessibilityLabel={r.photoHint}
            />
          </View>
        )}
      </Card>

    </Screen>
  );
}
