/**
 * When to say «Dispositivo emparejado» in product mode.
 *
 * **Why one notice and not two (2026-11-23).** The development build says the link and the network
 * separately («Dispositivo conectado», then «Red con el dispositivo lista»), which is what the team
 * needs to tell a BLE problem from a WiFi one. For the user they read as two steps of something that
 * might still go wrong, with nothing for them to do in between. Product mode says one sentence, once
 * the device is actually usable.
 *
 * "Usable" is the network being ready (supermarket mode needs the photo). It is not waited for
 * forever, though, because the device is usable without it too: bus mode runs entirely on the board.
 * So the notice also comes out when the phone turns out to be on another network (`networkAbsent`,
 * at home on the home WiFi) and, failing everything, after `fallbackMs` from the link. A silent
 * connection is the one outcome that is never acceptable: the user would be left waiting for a word.
 *
 * A network failure does not say it. It has its own sentence («Todavía no pude conectarme…»), and
 * saying "paired" a few seconds after that would sound like the failure was resolved. If the network
 * comes back afterwards, that is when «emparejado» is said.
 */
export interface PairedAnnouncerDeps {
  /** Says the notice. Only called when the app is in product mode at that instant. */
  sayPaired: () => void;
  /** Read at the instant: the user can switch modes in Settings while connected. */
  isProductMode: () => boolean;
  fallbackMs: number;
}

export interface PairedAnnouncer {
  /** The BLE link just came up. */
  linked: () => void;
  /** The device's network became ready (the caller already dedupes per network). */
  networkReady: () => void;
  /** The network check ended without the device's network, and without a failure to report. */
  networkAbsent: () => void;
  /** The network failed and its own notice was said. */
  networkFailed: () => void;
  /** The link is gone or the user disconnected: nothing pending survives it. */
  reset: () => void;
}

export function createPairedAnnouncer({ sayPaired, isProductMode, fallbackMs }: PairedAnnouncerDeps): PairedAnnouncer {
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stopTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const say = () => {
    pending = false;
    stopTimer();
    sayPaired();
  };

  return {
    linked() {
      stopTimer();
      pending = true;
      timer = setTimeout(() => {
        timer = null;
        if (pending && isProductMode()) say();
      }, fallbackMs);
    },
    networkReady() {
      // Said even when nothing is pending: a network that failed and came back is the user's cue
      // that supermarket mode works again, which «Red con el dispositivo lista» used to be.
      if (isProductMode()) say();
      else {
        pending = false;
        stopTimer();
      }
    },
    networkAbsent() {
      if (pending && isProductMode()) say();
    },
    networkFailed() {
      stopTimer();
    },
    reset() {
      pending = false;
      stopTimer();
    },
  };
}
