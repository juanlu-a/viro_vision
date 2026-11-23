/**
 * Where ViroVision is heard: the phone, or the device's speaker.
 *
 * It governs everything that makes a sound — both readings, the link and network notices, the mode
 * and the chirp (since 2026-09-16). It used to govern only the readings, and a user with the output
 * on the glasses got the product from the glasses and every other sound from their pocket.
 *
 * Drawn with `DropdownSelect`, like the model and the app mode: a one-line trigger whose label already
 * states what is in force ("Dónde se escucha: En el teléfono"), and a `radiogroup` with `checked` —
 * which is what tells a screen reader the options are mutually exclusive. Not a `Switch`: two named
 * destinations are not on/off, and "audio en el dispositivo, desactivado" says nothing about where
 * the sound actually goes. It had its own copy of that dropdown until 2026-11-23.
 *
 * The choice is applied **and spoken**. Unlike the theme, this one changes what the user is about to
 * hear and where, so confirming it by voice is the only feedback available to someone who is not
 * looking at the screen.
 */
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { ThemedText } from '@/components/themed-text';
import { announce } from '@/features/audio/announcer';
import { notify } from '@/features/audio/systemNotice';
import { strings } from '@/i18n';
import { isSynthesisEnabled } from '@/services/audio/synthesis';
import type { AudioOutput } from './audioOutput';

import { useAudioOutput } from './AudioOutputProvider';

const OPTIONS: readonly DropdownOption<AudioOutput>[] = [
  {
    value: 'phone',
    label: strings.settings.audioOutputPhone,
    hint: strings.settings.audioOutputPhoneHint,
    icon: 'phone-portrait',
  },
  {
    value: 'device',
    label: strings.settings.audioOutputDevice,
    hint: strings.settings.audioOutputDeviceHint,
    icon: 'hardware-chip',
  },
];

export function AudioOutputSelector() {
  const { output, setOutput } = useAudioOutput();

  const choose = (value: AudioOutput) => {
    setOutput(value);
    // Said out loud because this setting decides where the next sentence comes from — and **out of
    // the output just chosen**, which `setOutput` already applied to the module state above. That is
    // the confirmation doing double duty: the user does not have to take our word for it, they hear
    // the new output work in the same second they pick it.
    //
    // The caveat is the exception, and it stays on the phone. It says that a supermarket reading
    // cannot reach the board in this build, and there is no clip for it — the board saying "en el
    // dispositivo" and then being unable to read anything is worse than saying it from the phone.
    if (value === 'device' && !isSynthesisEnabled) {
      void announce(`${strings.settings.audioOutputSetToDevice} ${strings.settings.audioOutputNotConfigured}`);
      return;
    }
    void notify(value === 'device' ? 'outputSetToDevice' : 'outputSetToPhone');
  };

  return (
    <>
      <DropdownSelect
        value={output}
        options={OPTIONS}
        onChange={choose}
        label={strings.settings.audioOutput}
        hint={strings.settings.audioOutputHint}
        menuLabel={strings.settings.audioOutput}
      />

      {/* The bus caveat is written where the choice is made, not in a help screen: it is the one
          thing about this setting that surprises, and ADR 0001 is the reason it cannot be otherwise. */}
      <ThemedText type="small" themeColor="textSecondary">
        {strings.settings.audioOutputBusNote}
      </ThemedText>
    </>
  );
}
