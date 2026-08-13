import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { AccessibleButton } from '@/components/accessible-button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemeSelector } from '@/features/theme/ThemeSelector';
import { strings } from '@/i18n';
import { isOnDeviceSpikeEnabled } from '@/services/ondevice';
import { loadUserName, saveUserName } from '@/services/storage/userName';
import { isVisionConfigured } from '@/services/vision';

export default function SettingsScreen() {
  const t = strings.settings;
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    loadUserName().then(setNombre);
  }, []);

  return (
    <Screen scroll>
      <ScreenHeader title={t.title} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.appearance.toUpperCase()}
        </ThemedText>
        <ThemeSelector />
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.nameSection.toUpperCase()}
        </ThemedText>
        {/* Se guarda al escribir, sin botón: un "Guardar" es un paso más para recorrer con el
            lector de pantalla y no protege nada — el dato es un saludo. */}
        <TextField
          label={t.nameLabel}
          hint={t.nameHint}
          placeholder={t.namePlaceholder}
          value={nombre}
          autoComplete="name"
          onChangeText={(v) => {
            setNombre(v);
            void saveUserName(v);
          }}
        />
      </Card>

      <Card>
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
          {t.about.toUpperCase()}
        </ThemedText>
        <ThemedText type="default" className="font-sans-bold">
          {strings.app.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {strings.app.tagline}
        </ThemedText>
      </Card>

      {/*
        Herramientas de medición de la tesis. El gate es la presencia de la clave, no __DEV__:
        así el benchmark también existe en un build de release local (necesario para medir en la
        calle sin la laptop), pero desaparece solo en cualquier build que no lleve la clave —
        y la clave nunca debe viajar en un build distribuible (ver app/.env.example).
      */}
      {(__DEV__ || isVisionConfigured) && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {t.developer.toUpperCase()}
          </ThemedText>
          <AccessibleButton
            label={t.openBenchmark}
            hint={t.openBenchmarkHint}
            variant="secondary"
            onPress={() => router.push('/dev/vision-bench')}
          />
          {/* Mismo criterio que el benchmark: gatear por __DEV__ la escondía justo donde hay que
              medirla, que es un build de Release en el teléfono. Va por variable de entorno. */}
          {isOnDeviceSpikeEnabled && (
            <AccessibleButton
              label={strings.ondevice.title}
              hint={strings.ondevice.probeHint}
              variant="secondary"
              onPress={() => router.push('/dev/ondevice-bench')}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
