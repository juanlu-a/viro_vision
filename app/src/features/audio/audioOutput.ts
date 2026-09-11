/**
 * Where a supermarket reading is heard, and the rule for when that choice cannot be honoured.
 *
 * **Why the choice exists.** The final device does not exist yet, so both paths have to be reachable
 * at runtime to be compared — standing in front of a shelf, not by rebuilding. The phone speaks with
 * `expo-speech` and nothing else; the device needs the sentence synthesized to a file in the cloud
 * and POSTed to its HTTP server (ADR 0003), which is slower and has more ways to fail.
 *
 * **Why only supermarket.** Routing a bus reading through the device would mean synthesizing it with
 * a cloud TTS, and bus mode has to work with no internet at all (ADR 0001, ADR 0006). ADR 0003
 * already answers this: the bus announcements are **prerecorded on the board's SD** for exactly that
 * reason. They do not exist yet, so the bus path speaks through the phone regardless of this setting.
 *
 * **No storage import here, on purpose** — same rule as `services/audio/audioMode.ts`. Reading this
 * module must not drag in AsyncStorage: `readingService.ts` imports it, and its test suite (and this
 * one) would then need a native mock to assert a decision that is pure. The persistence lives in
 * `services/storage/audioOutputPreference.ts` and is driven by the provider.
 *
 * **The module state is deliberate.** `readingService.ts` is not a React component (it stopped being
 * a hook so the physical button would work with the screen locked), so it reads the choice from here
 * at the instant of the reading. Same shape as the speech volume in `services/audio/tts.ts`.
 */

/** Where the reading is heard. `device` = the board's speaker (ADR 0003). */
export type AudioOutput = 'phone' | 'device';

/**
 * The phone. Not the device, on purpose: the phone is the only output that is certainly there, and a
 * default that needs hardware nobody has yet would make a fresh install silent.
 */
export const DEFAULT_AUDIO_OUTPUT: AudioOutput = 'phone';

export function isAudioOutput(value: unknown): value is AudioOutput {
  return value === 'phone' || value === 'device';
}

let current: AudioOutput = DEFAULT_AUDIO_OUTPUT;

/** Read at the instant of a reading, never captured beforehand. */
export function getAudioOutput(): AudioOutput {
  return current;
}

/** Applies the choice in memory. Persisting it is the provider's job. */
export function setAudioOutput(value: AudioOutput): void {
  current = value;
}

/** Test seam: the module state would otherwise leak between test files. */
export function resetAudioOutputForTests(): void {
  current = DEFAULT_AUDIO_OUTPUT;
}

export interface DeliveryContext {
  /** What the user chose in Settings. */
  output: AudioOutput;
  /** Whether the device is connected, on its network and answering (`photoAvailable`). */
  deviceReady: boolean;
  /** Whether this build can synthesize to a file at all (`EXPO_PUBLIC_AUDIO_FILE_ENABLED` + a key). */
  synthesisEnabled: boolean;
}

export type Delivery =
  | { target: 'device' }
  /** `fallback` says why the device could not be used; absent when the phone is what was asked for. */
  | { target: 'phone'; fallback?: 'not-configured' | 'device-unreachable' };

/**
 * Decides where this reading goes.
 *
 * **The phone is the fallback, always.** A reading the user asked for and cannot hear is the one
 * outcome this app must never produce: the voice is the interface, and silence is indistinguishable
 * from a device that crashed. So every reason the device path cannot work ends with the phone
 * speaking, and the reason is recorded rather than announced — saying "I could not use the board"
 * before every sentence would be noise in front of a shelf, and the user already gets what they
 * asked for.
 *
 * Both conditions are checked **before** synthesizing, not after: the synthesis is a paid cloud call
 * and a couple of seconds, and spending either on audio that has nowhere to go is worse than
 * checking twice.
 */
export function decideDelivery({ output, deviceReady, synthesisEnabled }: DeliveryContext): Delivery {
  if (output === 'phone') return { target: 'phone' };
  if (!synthesisEnabled) return { target: 'phone', fallback: 'not-configured' };
  if (!deviceReady) return { target: 'phone', fallback: 'device-unreachable' };
  return { target: 'device' };
}
