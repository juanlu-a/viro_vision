/**
 * Product mode says «Dispositivo emparejado» once, when the device is usable (2026-11-23). The rule
 * that matters most is the last one here: a connection is never silent.
 */
import { createPairedAnnouncer } from './pairedNotice';

const FALLBACK_MS = 30_000;

function setup(productMode = true) {
  const said: string[] = [];
  let product = productMode;
  const announcer = createPairedAnnouncer({
    sayPaired: () => said.push('paired'),
    isProductMode: () => product,
    fallbackMs: FALLBACK_MS,
  });
  return { announcer, said, setProduct: (value: boolean) => (product = value) };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('the paired notice', () => {
  it('is said once, when the network is ready, and not at the BLE link', () => {
    const { announcer, said } = setup();
    announcer.linked();
    expect(said).toEqual([]);
    announcer.networkReady();
    expect(said).toEqual(['paired']);
    jest.advanceTimersByTime(FALLBACK_MS * 2);
    expect(said).toEqual(['paired']);
  });

  it('is said when the phone is on another network: bus mode works without it', () => {
    const { announcer, said } = setup();
    announcer.linked();
    announcer.networkAbsent();
    expect(said).toEqual(['paired']);
    announcer.networkAbsent();
    expect(said).toEqual(['paired']);
  });

  it('is said by the fallback when the network never settles', () => {
    const { announcer, said } = setup();
    announcer.linked();
    jest.advanceTimersByTime(FALLBACK_MS - 1);
    expect(said).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(said).toEqual(['paired']);
  });

  it('waits for the network after a failure instead of contradicting it', () => {
    const { announcer, said } = setup();
    announcer.linked();
    announcer.networkFailed();
    jest.advanceTimersByTime(FALLBACK_MS * 2);
    expect(said).toEqual([]);
    announcer.networkReady();
    expect(said).toEqual(['paired']);
  });

  it('says nothing after the link is gone', () => {
    const { announcer, said } = setup();
    announcer.linked();
    announcer.reset();
    jest.advanceTimersByTime(FALLBACK_MS * 2);
    announcer.networkAbsent();
    expect(said).toEqual([]);
  });

  it('is never said in development mode, which keeps its two notices', () => {
    const { announcer, said } = setup(false);
    announcer.linked();
    announcer.networkAbsent();
    announcer.networkReady();
    jest.advanceTimersByTime(FALLBACK_MS * 2);
    expect(said).toEqual([]);
  });
});
