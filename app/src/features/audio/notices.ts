/**
 * The catalogue of **system notices**: everything ViroVision says about itself — the link, the
 * network, the mode, the setting — as opposed to what it says about what the camera saw.
 *
 * **Why a closed catalogue and not free text.** A notice has to be sayable by the board too, and the
 * board has no speech synthesizer: its announcements are `.wav` files on the SD (ADR 0003 §5),
 * because bus mode has to work with no internet and a TTS does not fit in a Pi 3 B+ next to the OCR.
 * A fixed set of sentences is what makes "everything comes out of the output the user chose"
 * possible at all. Free text would mean a cloud synthesis, and the network notices are precisely the
 * ones that fire when the network is gone — the announcement "no se pudo usar la red" cannot itself
 * need the network.
 *
 * **Each entry names its own `.wav`, and the names are mirrored** in
 * `hardware/raspi/virovision/notices.py`, which is also where the Spanish the generator records
 * lives. A typo on this side is silent: the board logs "nothing can play" and the user simply hears
 * nothing, so the mirror is asserted by a test on each side rather than left to convention.
 *
 * **The board's sentence and the phone's are not always the same string, on purpose.** Three notices
 * carry a variable detail (which network failed, what the board complained about). The phone appends
 * it; the board says a self-contained fixed sentence and the detail stays on screen and in
 * telemetry, where it already is. Recording one clip per possible error message is not a thing that
 * exists.
 */
import { strings } from '@/i18n';

export interface Notice {
  /**
   * The `.wav` on the board, under `/home/virovision/announcements/system/`.
   *
   * `null` means this notice can never be heard on the board, and each one says why: the
   * confirmation of having chosen the phone (which by definition comes out of the phone) and the
   * lost link (the board cannot report that it is gone). It is not "not recorded yet" — a missing
   * clip routes to the phone silently, so the distinction has to be explicit.
   */
  clip: string | null;
  /**
   * What the phone says. `null` means this notice is not a sentence: the reading chirp, which the
   * phone plays as a sound file (`services/audio/session.ts`).
   */
  say: string | null;
}

/**
 * The notices, by id. The ids are English (ADR 0009); the sentences are Spanish because a person
 * hears them.
 */
export const NOTICES = {
  connected: { clip: 'connected.wav', say: strings.connection.connectedAnnounce },
  /**
   * No clip, and not an oversight: the board cannot announce its own absence. By the time this
   * fires the client has already dropped the link (`cleanup()` runs before the listeners), so
   * `isLinked()` is false and the rule routes it to the phone anyway. Recording a `.wav` for it
   * would put a file on the SD that nothing can ever reach.
   */
  connectionLost: { clip: null, say: strings.connection.lost },
  networkReady: { clip: 'network_ready.wav', say: strings.connect.wifiReadyAnnounce },
  /** Carries a detail: which step of joining the device's network failed. */
  networkFailed: { clip: 'network_failed.wav', say: strings.connect.wifiFailedAnnounce },
  /** Carries a detail: the board's own message. */
  deviceWarning: { clip: 'device_warning.wav', say: strings.connect.deviceErrorAnnounce },
  /** Carries a detail: why the BLE write failed. */
  modeWriteFailed: { clip: 'mode_write_failed.wav', say: strings.connect.modeWriteFailed },
  modeIdle: { clip: 'mode_idle.wav', say: strings.reader.announceIdle },
  modeBus: { clip: 'mode_bus.wav', say: strings.reader.announceBus },
  modeSupermarket: { clip: 'mode_supermarket.wav', say: strings.reader.announceSupermarket },
  /** No clip: choosing the phone routes this very confirmation to the phone. */
  outputSetToPhone: { clip: null, say: strings.settings.audioOutputSetToPhone },
  outputSetToDevice: { clip: 'output_device.wav', say: strings.settings.audioOutputSetToDevice },
  /**
   * The "Probar audio" button. It is a notice and not free speech for the obvious reason: a test of
   * the output that always came out of the phone would test nothing the user cares about.
   */
  audioTest: { clip: 'audio_test.wav', say: strings.home.testAudioPhrase },
  /**
   * The chirp the instant a reading is requested. Routing it costs the diagnostic value it had on
   * the phone (a chirp heard = the app woke up and its audio session works, see
   * `services/audio/session.ts`) and adds a BLE write to the one sound that has to be immediate.
   * It goes anyway: a user who put every other sound on the glasses and still gets one chirp from
   * their pocket has no way to read that as anything but a bug.
   */
  readingStarted: { clip: 'earcon_start.wav', say: null },
} as const satisfies Record<string, Notice>;

export type SystemNotice = keyof typeof NOTICES;

/** The mode announcements, by mode. Kept next to the catalogue so a new mode cannot forget one. */
export const MODE_NOTICE = {
  idle: 'modeIdle',
  bus: 'modeBus',
  supermarket: 'modeSupermarket',
} as const satisfies Record<string, SystemNotice>;
