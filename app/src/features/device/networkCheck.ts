/**
 * Two decisions the device's network check makes on every run, kept out of `DeviceProvider` so they
 * can be tested without React or a radio.
 *
 * **Say a failure once.** A check that failed is retried on every `status` heartbeat (15 s), and each
 * retry that failed the same way used to say the failure sentence again: the user heard "no pude usar
 * la red" every 15 s for as long as it lasted (review of 2026-11-23). The retry stays; the sentence
 * is said once per distinct failure (`reason@ip`), and again only after the network was ready or the
 * link started over.
 *
 * **Prompt for a network once per attempt.** iOS asks "¿Querés unirte a ViroVision?" every time the
 * app asks to join. A network this phone already joined is not asked for at all (iOS rejoins it by
 * itself, 2026-11-20). A heartbeat retry does not ask again for a network it already asked for: a user
 * who dismissed the alert would otherwise get it every 15 s. A retry that never got as far as asking
 * (the credentials read failed the first time) still may, and a reading that needs the photo always
 * may (`joinNetwork`).
 */
export interface NetworkCheckGate {
  /** True when this failure has not been said yet; remembers it as said. */
  shouldAnnounceFailure(reason: string, ip: string | null): boolean;
  /**
   * Whether this run may show the system's join prompt, and remembers the SSID when it may.
   * `joinedSsid` is the network this phone already joined (saved), or null.
   */
  mayPrompt(options: { ssid: string | null; joinedSsid: string | null; retry: boolean; always: boolean }): boolean;
  /** Whether `mayPrompt` needs the saved network: false lets the caller skip reading storage. */
  needsJoinedSsid(options: { ssid: string | null; retry: boolean; always: boolean }): boolean;
  /** The network is ready: a later failure is news again, and so is a later prompt. */
  ready(): void;
  /** The AP is changing: a failure on the new one is news. The prompt memory is kept. */
  transition(): void;
  /** The link is gone (lost or closed by the user): everything starts over. */
  reset(): void;
}

export function createNetworkCheckGate(): NetworkCheckGate {
  let announcedFailure: string | null = null;
  let promptedFor: string | null = null;

  const alreadyPrompted = (ssid: string | null, retry: boolean) => retry && ssid !== null && promptedFor === ssid;

  return {
    shouldAnnounceFailure(reason, ip) {
      const key = `${reason}@${ip ?? ''}`;
      if (announcedFailure === key) return false;
      announcedFailure = key;
      return true;
    },
    needsJoinedSsid({ ssid, retry, always }) {
      return !always && ssid !== null && !alreadyPrompted(ssid, retry);
    },
    mayPrompt({ ssid, joinedSsid, retry, always }) {
      const may = always || (!alreadyPrompted(ssid, retry) && (ssid === null || joinedSsid !== ssid));
      if (may && ssid !== null) promptedFor = ssid;
      return may;
    },
    ready() {
      announcedFailure = null;
      promptedFor = null;
    },
    transition() {
      announcedFailure = null;
    },
    reset() {
      announcedFailure = null;
      promptedFor = null;
    },
  };
}
