/**
 * Says a system notice where the user chose to hear it.
 *
 * **Why this module exists.** Until 2026-09-16 the setting in Settings governed the two readings and
 * nothing else: the link, the network, the mode change, the chirp and even the confirmation of the
 * setting itself all went to `announce()`, which is `expo-speech` and therefore always the phone. A
 * user wearing the glasses with the output on the device heard the product from the glasses and
 * everything else from their pocket — which is not a smaller version of the feature, it is the app
 * looking broken. This is the single delivery point for all of it, so the two outputs cannot drift
 * apart again; it is `deliverReading`'s counterpart and deliberately the same shape.
 *
 * **The board is reached through injected deps, not by importing the BLE client** — same rule as
 * `audioOutput.ts`, and it is not style. `services/ble/bleClient` pulls in `bleClientPlx`, which
 * pulls in AsyncStorage, which needs a native mock; a static import here would put that mock in the
 * test file of everything that ever announces anything, to exercise a decision that is pure. It is
 * also the safer default: with nothing installed the notice goes to the phone, which is the answer
 * that is always right.
 *
 * **The deps are getters, resolved at the instant of the notice.** `DeviceProvider` calls `notify`
 * from inside a BLE callback with the screen locked, and a value captured at install time would be
 * a link state from minutes ago. Same shape as `configureReader`, one layer down.
 *
 * **No telemetry here.** `features/audio/**` may not import `@/services/telemetry` (ADR 0001 +
 * ADR 0008, enforced in `eslint.config.js`): the announcement path must not carry a network call.
 * `notify` returns the output that actually spoke so the callers that ARE allowed to record —
 * `features/reader`, `features/device` — can put it in the table.
 */
import { announce } from '@/features/audio/announcer';
import { decideNoticeDelivery, getAudioOutput, type AudioOutput } from '@/features/audio/audioOutput';
import { NOTICES, type SystemNotice } from '@/features/audio/notices';
import { playStartEarcon } from '@/services/audio/session';
import { stopSpeaking } from '@/services/audio/tts';

export interface NoticeDeps {
  /** Whether there is a live BLE link right now. Synchronous: the decision cannot await. */
  isLinked(): boolean;
  /** Plays one pre-recorded clip on the device's speaker. Rejects if the link went away. */
  playNotice(clip: string): Promise<void>;
  /** Cuts whatever the device's speaker is playing. Called before the phone speaks. */
  hushDevice(): Promise<void>;
}

/** No device until something says otherwise, which routes every notice to the phone. */
const noDevice: NoticeDeps = {
  isLinked: () => false,
  playNotice: () => Promise.reject(new Error('NOTICE_TRANSPORT_NOT_CONFIGURED')),
  hushDevice: () => Promise.resolve(),
};

let deps: NoticeDeps = noDevice;

/** Installed once, from `ReaderBridge`, which is mounted above every screen. */
export function configureNotices(next: NoticeDeps): void {
  deps = next;
}

/** Test seam: the module state would otherwise leak between test files. */
export function resetNoticesForTests(): void {
  deps = noDevice;
}

/**
 * Says `id`, and resolves with where it was actually heard.
 *
 * `detail` is the variable part some notices carry — which network failed, what the board
 * complained about. **The phone appends it; the board does not get it**, because the board speaks
 * with clips recorded ahead of time and nobody can record one per error message. That is a
 * deliberate loss and a bounded one: the detail is already on screen and in telemetry, which is
 * where a technical string belongs, and the fixed sentence still names the thing that failed.
 *
 * It **never rejects**. Same rule as `announce()` and for the same reason (ADR 0001): nothing on the
 * announcement path may throw at a caller that is often a BLE callback with no one to catch it.
 */
export async function notify(id: SystemNotice, detail?: string): Promise<AudioOutput> {
  const notice = NOTICES[id];
  // The whole device path is inside the try, the decision included: `isLinked` is the BLE client
  // reaching into a native module, and a notice that throws instead of falling back to the phone
  // would take down whatever BLE callback called it.
  // Consultado una sola vez y guardado: lo necesitan la decisión y, más abajo, el silenciado de la
  // placa. Si `isLinked` explota queda en `false`, que es la respuesta segura — no se le habla a un
  // enlace que no sabemos si existe.
  let linked = false;
  try {
    linked = deps.isLinked();
    const delivery = decideNoticeDelivery({
      output: getAudioOutput(),
      // Asked here and not inside the transport: the decision has to be visible and testable without
      // a radio, which is the whole reason `decideNoticeDelivery` is a pure function.
      deviceLinked: linked,
      hasClip: notice.clip !== null,
    });
    if (delivery.target === 'device' && notice.clip) {
      // Una voz por vez, venga de donde venga. Cada salida ya se interrumpía a sí misma —el teléfono
      // con `Speech.stop()`, la placa cortando el `aplay` anterior— y ninguna interrumpía a la otra,
      // así que cambiar el ajuste a mitad de un anuncio dejaba las dos hablando encimadas. Para quien
      // no ve la pantalla, dos voces simultáneas no son información: son ruido.
      stopSpeaking();
      await deps.playNotice(notice.clip);
      return 'device';
    }
  } catch {
    // The link died between the check and the write. Falling through to the phone can, in theory,
    // say it twice if the write landed after all — the same trade `deliverReading` already makes,
    // and for the same reason: paying twice is much better than leaving the user with nothing.
  }

  // La otra mitad de la misma regla: si habla el teléfono, la placa se calla. Sin `await` y tragando
  // su error — es mejor arriesgar un solapamiento que demorar el aviso detrás de una escritura BLE.
  if (linked) void deps.hushDevice().catch(() => {});

  // Not wrapped: both halves of this are non-throwing by contract (`announce` resolves on failure,
  // `playStartEarcon` swallows its own errors). Wrapping it too would hide a broken one of those.
  await sayOnPhone(id, detail);
  return 'phone';
}

async function sayOnPhone(id: SystemNotice, detail?: string): Promise<void> {
  const { say } = NOTICES[id];
  // The one notice that is not a sentence: the reading chirp is a sound file, not speech.
  if (say === null) {
    playStartEarcon();
    return;
  }
  await announce(detail ? `${say} ${detail}` : say);
}
