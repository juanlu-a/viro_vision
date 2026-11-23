/**
 * The two rules that decide whether the user hears a network failure at all, and whether iOS asks
 * them to join again. Both used to live inline in `DeviceProvider`, untested, and the first one was
 * found repeating the failure sentence every 15 s (review of 2026-11-23).
 */
import { createNetworkCheckGate } from './networkCheck';

describe('failure announcements', () => {
  it('says a failure once, however many heartbeats retry it', () => {
    const gate = createNetworkCheckGate();
    expect(gate.shouldAnnounceFailure('unreachable', '192.168.4.1')).toBe(true);
    expect(gate.shouldAnnounceFailure('unreachable', '192.168.4.1')).toBe(false);
    expect(gate.shouldAnnounceFailure('unreachable', '192.168.4.1')).toBe(false);
  });

  it('says a different failure, or the same one on another address', () => {
    const gate = createNetworkCheckGate();
    gate.shouldAnnounceFailure('unreachable', '192.168.4.1');
    expect(gate.shouldAnnounceFailure('refused', '192.168.4.1')).toBe(true);
    expect(gate.shouldAnnounceFailure('refused', '10.0.0.5')).toBe(true);
  });

  it('says it again after the network was ready, after an AP change and after the link started over', () => {
    for (const clear of ['ready', 'transition', 'reset'] as const) {
      const gate = createNetworkCheckGate();
      gate.shouldAnnounceFailure('unreachable', '192.168.4.1');
      gate[clear]();
      expect(gate.shouldAnnounceFailure('unreachable', '192.168.4.1')).toBe(true);
    }
  });
});

describe('join prompts', () => {
  const fresh = { ssid: 'ViroVision', joinedSsid: null, retry: false, always: false };

  it('prompts for a network this phone never joined', () => {
    expect(createNetworkCheckGate().mayPrompt(fresh)).toBe(true);
  });

  it('never prompts for a network this phone already joined: iOS rejoins it by itself', () => {
    expect(createNetworkCheckGate().mayPrompt({ ...fresh, joinedSsid: 'ViroVision' })).toBe(false);
  });

  it('does not prompt again on a heartbeat retry for a network it already prompted for', () => {
    const gate = createNetworkCheckGate();
    gate.mayPrompt(fresh);
    expect(gate.mayPrompt({ ...fresh, retry: true })).toBe(false);
    expect(gate.needsJoinedSsid({ ssid: 'ViroVision', retry: true, always: false })).toBe(false);
  });

  it('still prompts on a retry that never got as far as prompting', () => {
    // The first run failed reading the credentials, before any prompt could happen.
    expect(createNetworkCheckGate().mayPrompt({ ...fresh, retry: true })).toBe(true);
  });

  it('always prompts when a reading needs the photo', () => {
    const gate = createNetworkCheckGate();
    gate.mayPrompt(fresh);
    expect(gate.mayPrompt({ ...fresh, retry: true, always: true })).toBe(true);
    expect(gate.mayPrompt({ ...fresh, joinedSsid: 'ViroVision', always: true })).toBe(true);
  });

  it('prompts again after the network was ready or the link started over, but not after an AP change', () => {
    for (const [clear, expected] of [['ready', true], ['reset', true], ['transition', false]] as const) {
      const gate = createNetworkCheckGate();
      gate.mayPrompt(fresh);
      gate[clear]();
      expect(gate.mayPrompt({ ...fresh, retry: true })).toBe(expected);
    }
  });

  it('a development board on the same network has nothing to join and nothing to remember', () => {
    const gate = createNetworkCheckGate();
    expect(gate.mayPrompt({ ...fresh, ssid: null })).toBe(true);
    expect(gate.needsJoinedSsid({ ssid: null, retry: false, always: false })).toBe(false);
  });
});
