import { toAnnouncement } from './format';
import type { RecognitionEvent } from './types';

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
