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
   * El enlace y la red son del teléfono, siempre (decisión del 2026-09-17).
   *
   * No es una limitación técnica sino el orden de los hechos: cuando se anuncia que el dispositivo
   * se conectó, el dispositivo **acaba de existir** para la app, y el usuario está con el teléfono
   * en la mano emparejando, no con los anteojos puestos. Un aviso sobre el enlace que viaja por ese
   * mismo enlace es circular, y el que dice que la red falló no puede ir por la red.
   *
   * La versión anterior sí los mandaba a la placa y costó caro: la escritura BLE del aviso salía en
   * el mismo instante en que la app leía la característica `wifi` para unirse al AP, y el teléfono
   * se quedaba sin credenciales. Con la salida en «teléfono» el mismo build andaba. Ver
   * `services/ble/serialize.ts`.
   */
  connected: { clip: null, say: strings.connection.connectedAnnounce },
  /** La placa no puede anunciar su propia ausencia. */
  connectionLost: { clip: null, say: strings.connection.lost },
  networkReady: { clip: null, say: strings.connect.wifiReadyAnnounce },
  /** Lleva un detalle: qué paso de la unión a la red falló. */
  networkFailed: { clip: null, say: strings.connect.wifiFailedAnnounce },
  /**
   * Lleva un detalle: el mensaje de la propia placa.
   *
   * Sin clip desde el 2026-09-16, y por un motivo más fuerte que el resto: **la placa no reporta sus
   * propias fallas.** Mandárselo cerraba un lazo —la placa contesta con un error lo que no entiende,
   * la app convierte todo error de la placa en este aviso, y volvía— en el que nunca se decía nada.
   */
  deviceWarning: { clip: null, say: strings.connect.deviceErrorAnnounce },
  /** Lleva un detalle: por qué falló la escritura. Es una falla del enlace, así que del teléfono. */
  modeWriteFailed: { clip: null, say: strings.connect.modeWriteFailed },

  /**
   * Los modos sí: son lo que el usuario escucha **con los anteojos puestos y el teléfono guardado**,
   * que es la situación del producto. Junto con las lecturas de cada modo, es todo lo que la placa
   * dice.
   */
  modeIdle: { clip: 'mode_idle.wav', say: strings.reader.announceIdle },
  modeBus: { clip: 'mode_bus.wav', say: strings.reader.announceBus },
  modeSupermarket: { clip: 'mode_supermarket.wav', say: strings.reader.announceSupermarket },
  /**
   * El chirp del instante en que se pide una lectura. Va con los modos y no con el enlace porque es
   * propio de la lectura: confirma que el botón hizo algo durante los segundos que tarda la nube.
   */
  readingStarted: { clip: 'earcon_start.wav', say: null },

  /**
   * Las dos que verifican la salida misma, y por eso siguen el ajuste aunque no sean de un modo:
   * una confirmación de «se escucha en el dispositivo» dicha por el teléfono no confirma nada, y un
   * botón de «probar audio» que suena siempre en el teléfono prueba justo lo que no se preguntó.
   * Ninguna de las dos corre durante una secuencia BLE: las dispara el usuario desde Ajustes.
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
