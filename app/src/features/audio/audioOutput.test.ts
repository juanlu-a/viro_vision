/**
 * Exists because the rule under test is "the user always hears the reading", and every way of
 * getting it wrong is invisible in a code review: the device path needs a cloud synthesis and an
 * HTTP POST, either can fail, and a bug here does not throw or log — it produces **silence**, which
 * for someone who cannot see the screen is indistinguishable from a device that died.
 *
 * The other half is money and time: deciding to synthesize before checking that the device can
 * receive it spends a paid cloud call on audio nobody will hear.
 */
import { decideDelivery, decideNoticeDelivery } from './audioOutput';

const ready = { deviceReady: true, synthesisEnabled: true };

describe('decideDelivery', () => {
  it('sends to the device when that is what was chosen and it can work', () => {
    expect(decideDelivery({ output: 'device', ...ready })).toEqual({ target: 'device' });
  });

  it('speaks on the phone when that is what was chosen', () => {
    // With no fallback reason: nothing failed, this is what the user asked for.
    expect(decideDelivery({ output: 'phone', ...ready })).toEqual({ target: 'phone' });
  });

  it('falls back to the phone when the build cannot synthesize', () => {
    // `EXPO_PUBLIC_AUDIO_FILE_ENABLED` off, or no key: choosing the device is stored and honoured as
    // far as it can be, and the reading is still heard.
    expect(decideDelivery({ output: 'device', deviceReady: true, synthesisEnabled: false })).toEqual({
      target: 'phone',
      fallback: 'not-configured',
    });
  });

  it('falls back to the phone when the device cannot receive audio', () => {
    expect(decideDelivery({ output: 'device', deviceReady: false, synthesisEnabled: true })).toEqual({
      target: 'phone',
      fallback: 'device-unreachable',
    });
  });

  it('never answers with silence', () => {
    // The whole point, stated as a property: for every combination there is somewhere the sentence
    // comes out.
    for (const output of ['phone', 'device'] as const) {
      for (const deviceReady of [true, false]) {
        for (const synthesisEnabled of [true, false]) {
          const delivery = decideDelivery({ output, deviceReady, synthesisEnabled });
          expect(['phone', 'device']).toContain(delivery.target);
        }
      }
    }
  });

  it('reports WHY the device was not used, so the two paths can be compared', () => {
    // Without the reason, the telemetry table cannot tell "the device is not configured in this
    // build" from "the device was out of range", and those lead to different places.
    const notConfigured = decideDelivery({ output: 'device', deviceReady: true, synthesisEnabled: false });
    const unreachable = decideDelivery({ output: 'device', deviceReady: false, synthesisEnabled: true });
    expect(notConfigured).not.toEqual(unreachable);
  });
});

/**
 * The second rule, and the reason it is a second rule. A system notice is a clip already on the
 * board's SD, so it needs neither the cloud nor the device's WiFi — only the BLE link. Judging it
 * with `decideDelivery` would refuse the device whenever synthesis is off or the AP is not up, and
 * the notices that matter most are precisely the ones that fire when the network is broken.
 */
describe('decideNoticeDelivery', () => {
  const linked = { deviceLinked: true, hasClip: true };

  it('sends to the device when that is what was chosen and there is a link', () => {
    expect(decideNoticeDelivery({ output: 'device', ...linked })).toEqual({ target: 'device' });
  });

  it('reaches the board in the very case a reading cannot', () => {
    // The whole difference between the two rules, stated against both at once: no synthesis, no
    // WiFi with the board answering — a reading has nowhere to go and a notice is already recorded
    // on the SD. If someone ever folds the two functions together, this is what fails, and the
    // symptom would be every network notice jumping back to the phone.
    expect(decideDelivery({ output: 'device', deviceReady: false, synthesisEnabled: false })).toEqual({
      target: 'phone',
      fallback: 'not-configured',
    });
    expect(decideNoticeDelivery({ output: 'device', deviceLinked: true, hasClip: true })).toEqual({
      target: 'device',
    });
  });

  it('speaks on the phone when that is what was chosen', () => {
    expect(decideNoticeDelivery({ output: 'phone', ...linked })).toEqual({ target: 'phone' });
  });

  it('falls back to the phone with no link', () => {
    expect(decideNoticeDelivery({ output: 'device', deviceLinked: false, hasClip: true })).toEqual({
      target: 'phone',
      fallback: 'device-unreachable',
    });
  });

  it('falls back to the phone for a notice the board has no clip for', () => {
    // The lost link is the live example: the board cannot announce its own absence.
    expect(decideNoticeDelivery({ output: 'device', deviceLinked: true, hasClip: false })).toEqual({
      target: 'phone',
      fallback: 'no-clip',
    });
  });

  it('never answers with silence', () => {
    for (const output of ['phone', 'device'] as const) {
      for (const deviceLinked of [true, false]) {
        for (const hasClip of [true, false]) {
          expect(['phone', 'device']).toContain(
            decideNoticeDelivery({ output, deviceLinked, hasClip }).target
          );
        }
      }
    }
  });
});
