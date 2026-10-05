import { toAnnouncement } from './format';
import type { Detection, RecognitionEvent } from './types';

const busEvent: RecognitionEvent = {
  timestamp: 0,
  primary: { kind: 'bus_line', label: '183', confidence: 0.9 },
  others: [{ kind: 'bus_line', label: '185', confidence: 0.7 }],
};

describe('toAnnouncement', () => {
  it('prefixes a bus line with "Línea"', () => {
    expect(toAnnouncement(busEvent)).toBe('Línea 183');
  });

  it('omits other detections by default (no auditory overload)', () => {
    expect(toAnnouncement(busEvent)).not.toContain('185');
  });

  it('mentions other detections when explicitly requested', () => {
    expect(toAnnouncement(busEvent, true)).toBe('Línea 183. También: Línea 185');
  });

  it('does not append "También" when there are no other detections', () => {
    const single: RecognitionEvent = { ...busEvent, others: [] };
    expect(toAnnouncement(single, true)).toBe('Línea 183');
  });

  it('announces products by label without a prefix', () => {
    const product: RecognitionEvent = {
      timestamp: 0,
      primary: { kind: 'product', label: 'Yerba Canarias 1kg', confidence: 0.82 },
      others: [],
    };
    expect(toAnnouncement(product)).toBe('Yerba Canarias 1kg');
  });
});

describe('a bus reading with a destination', () => {
  // Reported 2026-09-22 after a real run with the output on the phone: the board decided
  // "Bus 115, LUIS BRAILLE", the event carried `detail`, and the user heard only "Línea 115". The
  // destination was read on the board and dropped here, silently.
  const event = (primary: Detection): RecognitionEvent => ({ timestamp: 0, primary, others: [] });

  it('says the destination when it came', () => {
    expect(
      toAnnouncement(event({ kind: 'bus_line', label: '115', detail: 'LUIS BRAILLE', confidence: 0.9 }))
    ).toBe('Línea 115, LUIS BRAILLE');
  });

  it('says the line alone when it did not', () => {
    // The device trims `detail` first when the event does not fit one BLE notification, so a reading
    // with a number and no destination is normal, not a bug to paper over.
    expect(toAnnouncement(event({ kind: 'bus_line', label: '115', confidence: 0.9 }))).toBe('Línea 115');
  });

  it('says the destination alone when the number was not read', () => {
    // Reported 2026-09-23: the board decided "Bus CIUDAD VIEJA" with no number and the phone said
    // "Línea…" then a silence, then the destination.
    expect(toAnnouncement(event({ kind: 'bus_line', label: '', detail: 'CIUDAD VIEJA', confidence: 0.9 }))).toBe(
      'CIUDAD VIEJA'
    );
  });

  it('leaves products alone', () => {
    expect(toAnnouncement(event({ kind: 'product', label: 'Yerba Canarias', confidence: 0.9 }))).toBe(
      'Yerba Canarias'
    );
  });
});
