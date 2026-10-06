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
  /**
   * The link and the network are the phone's, always (decision of 2026-09-17).
   *
   * This is not a technical limitation but the order of events: when the device's connection is
   * announced, the device **has just come into existence** for the app, and the user is pairing
   * with the phone in hand, not wearing the glasses. A notice about the link that travels over that
   * same link is circular, and the one saying the network failed cannot go over the network.
   *
   * The previous version did send them to the board and it cost dearly: the BLE write of the notice
   * went out at the very moment the app read the `wifi` characteristic to join the AP, and the phone
   * was left without credentials. With the output set to "phone" the same build worked. See
   * `services/ble/serialize.ts`.
   */
  connected: { clip: null, say: strings.connection.connectedAnnounce },
  /** The board cannot announce its own absence. */
  connectionLost: { clip: null, say: strings.connection.lost },
  networkReady: { clip: null, say: strings.connect.wifiReadyAnnounce },
  networkFailed: { clip: null, say: strings.connect.wifiFailedAnnounce },
  networkUnusable: { clip: null, say: strings.connect.wifiUnusableAnnounce },

  /**
   * The modes do go to the board: they are what the user hears **with the glasses on and the phone
   * put away**, which is the product's situation. Together with each mode's readings, it is
   * everything the board says.
   */
  modeIdle: { clip: 'mode_idle.wav', say: strings.reader.announceIdle },
  modeBus: { clip: 'mode_bus.wav', say: strings.reader.announceBus },
  modeSupermarket: { clip: 'mode_supermarket.wav', say: strings.reader.announceSupermarket },
  /**
   * Bus mode takes tens of seconds to be ready after the board is switched on: that is how long
   * the OCR takes to load. Pressing the button inside that window left the device **mute**
   * (2026-09-22), which for someone who cannot see the screen is the same as a dead device.
   *
   * It goes with the modes and not with the device failures: the board is not in trouble, it is
   * just not ready yet, and nothing in the notice channel is broken while this plays. The board
   * triggers it, being the only one that knows whether its OCR has finished loading.
   */
  busWarmingUp: { clip: 'bus_warming_up.wav', say: strings.reader.announceBusWarmingUp },
  /**
   * The chirp at the instant a reading is requested. It goes with the modes and not with the link
   * because it belongs to the reading: it confirms the button did something during the seconds the
   * cloud takes.
   */
  readingStarted: { clip: 'earcon_start.wav', say: null },

  /**
   * The two that verify the output itself, and so follow the setting even though they belong to no
   * mode: a "heard on the device" confirmation spoken by the phone confirms nothing, and a "test
   * audio" button that always plays on the phone tests exactly what was not asked. Neither runs
   * during a BLE sequence: the user triggers them from Settings.
   */
  outputSetToPhone: { clip: null, say: strings.settings.audioOutputSetToPhone },
  outputSetToDevice: { clip: 'output_device.wav', say: strings.settings.audioOutputSetToDevice },
  audioTest: { clip: 'audio_test.wav', say: strings.home.testAudioPhrase },
} as const satisfies Record<string, Notice>;

export type SystemNotice = keyof typeof NOTICES;

/** The mode announcements, by mode. Kept next to the catalogue so a new mode cannot forget one. */
export const MODE_NOTICE = {
  idle: 'modeIdle',
  bus: 'modeBus',
  supermarket: 'modeSupermarket',
} as const satisfies Record<string, SystemNotice>;
