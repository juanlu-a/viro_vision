/**
 * Where what ViroVision says is heard, and the rule for when that choice cannot be honoured.
 *
 * **One choice, everything it can reach — since 2026-09-16.** The setting used to govern only the
 * two readings, so the link, the network, the mode and the chirp came out of the phone whatever it
 * said; for a user with the glasses on that reads as half the app being broken. There are two
 * decision functions below because a reading and a notice can fail for different reasons, never
 * because they answer to different settings.
 *
 * **Why the choice exists.** The final device does not exist yet, so both paths have to be reachable
 * at runtime to be compared — standing in front of a shelf, not by rebuilding. The phone speaks with
 * `expo-speech` and nothing else; the device needs the sentence synthesized to a file in the cloud
 * and POSTed to its HTTP server (ADR 0003), which is slower and has more ways to fail.
 *
 * **Bus mode obeys it too, since 2026-09-15.** It used to be excluded, and the reason was never the
 * rule: routing a bus reading through the device would have meant a cloud TTS, and bus mode has to
 * work with no internet at all (ADR 0001, ADR 0006). ADR 0003 always answered this with **announcements
 * prerecorded on the board's SD**; they simply did not exist. Now they do, so the choice applies, and
 * it applies on both sides: the device is told to stop speaking (`writeAudioTarget`) and the phone
 * starts (`ReaderBridge` subscribes to the reading). Neither half alone is enough - with only the
 * first, a reading set to the phone would be silent; with only the second, it would be said twice.
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

export interface NoticeDeliveryContext {
  /** What the user chose in Settings. The same choice that governs a reading; that is the whole point. */
  output: AudioOutput;
  /** Whether there is a live BLE link right now. */
  deviceLinked: boolean;
  /** Whether this notice has a `.wav` on the board at all (`features/audio/notices.ts`). */
  hasClip: boolean;
}

export type NoticeDelivery =
  | { target: 'device' }
  | { target: 'phone'; fallback?: 'no-clip' | 'device-unreachable' };

/**
 * Decides where a **system notice** is heard — the link, the network, the mode, the setting itself.
 *
 * It is a second rule and not `decideDelivery` with different arguments, because the two differ in
 * the one condition that matters: **a notice needs no synthesis.** A reading is a sentence nobody
 * recorded, so the device path costs a cloud call and an HTTP POST over the device's WiFi, and
 * `decideDelivery` has to refuse when either is missing. A notice is one of a closed set already
 * recorded on the board's SD (ADR 0003 §5), so the board can say it with no internet, no WiFi and no
 * key — over BLE, which is the link that is up whenever there is a device at all. Folding the two
 * into one function would have to check `synthesisEnabled` for both, and every network notice would
 * fall back to the phone at exactly the moment the user was told everything comes out of the
 * glasses. That is the bug reported on 2026-09-16, re-created one layer up.
 *
 * The fallback is the phone, for the same reason as always: a notice nobody hears is the same as no
 * notice, and these are the ones that explain why something else went quiet.
 */
export function decideNoticeDelivery({ output, deviceLinked, hasClip }: NoticeDeliveryContext): NoticeDelivery {
  if (output === 'phone') return { target: 'phone' };
  if (!hasClip) return { target: 'phone', fallback: 'no-clip' };
  if (!deviceLinked) return { target: 'phone', fallback: 'device-unreachable' };
  return { target: 'device' };
}
