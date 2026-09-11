/**
 * Holds the "where is the reading heard" choice for the UI, and restores it at startup.
 *
 * The provider is only for the screen. **The reading itself does not go through React**: it reads the
 * choice from `audioOutput.ts`'s module state at the instant it needs it, because `readingService.ts`
 * stopped being a hook so a press of the physical button would work with the screen locked. This
 * provider's job is to put the stored value into that module state once, and to re-render Settings
 * when it changes.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  loadAudioOutputPreference,
  saveAudioOutputPreference,
} from '@/services/storage/audioOutputPreference';

import { DEFAULT_AUDIO_OUTPUT, setAudioOutput, type AudioOutput } from './audioOutput';

interface AudioOutputValue {
  output: AudioOutput;
  setOutput: (value: AudioOutput) => void;
}

const AudioOutputContext = createContext<AudioOutputValue | null>(null);

export function AudioOutputProvider({ children }: { children: React.ReactNode }) {
  const [output, setState] = useState<AudioOutput>(DEFAULT_AUDIO_OUTPUT);

  // Restored once. Until it resolves the default (the phone) is in force, which is the safe side to
  // be on: the phone is the only output that is certainly there.
  useEffect(() => {
    let alive = true;
    void loadAudioOutputPreference().then((stored) => {
      // The module state is set even if this provider has already unmounted: it is what the reading
      // pipeline reads, and it does not belong to the React tree.
      setAudioOutput(stored);
      if (alive) setState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AudioOutputValue>(
    () => ({
      output,
      setOutput: (next) => {
        // Module state first, React second: a reading that starts in this same tick has to see the
        // new value, and it does not read React. Persisting is last and unawaited — the choice is
        // already in force, and a storage failure must not block it.
        setAudioOutput(next);
        setState(next);
        void saveAudioOutputPreference(next);
      },
    }),
    [output]
  );

  return <AudioOutputContext.Provider value={value}>{children}</AudioOutputContext.Provider>;
}

export function useAudioOutput(): AudioOutputValue {
  const value = useContext(AudioOutputContext);
  if (!value) throw new Error('useAudioOutput requires AudioOutputProvider');
  return value;
}
