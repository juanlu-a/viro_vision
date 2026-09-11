/**
 * Exists because the output of these functions is HEARD, not seen: a regression in the phrasing or
 * in the line-number heuristic breaks no screen and goes straight to the user. The cases come from
 * real spike failures (the licence plate as a candidate, low-confidence texts) — see
 * docs/spike-vision-local.md.
 */
import { guessBusReading, phraseBusReading, phraseProduct } from './reading';
import { strings } from '@/i18n';

describe('guessBusReading', () => {
  it('picks the 2-4 digit number and the first text with letters as the destination', () => {
    const reading = guessBusReading([
      { text: '427', score: 0.9 },
      { text: 'PORTONES', score: 0.8 },
    ]);
    expect(reading).toEqual({ line: '427', destination: 'PORTONES' });
  });

  it('discards low-confidence candidates instead of guessing them', () => {
    const reading = guessBusReading([
      { text: '116', score: 0.1 },
      { text: 'xx', score: 0.9 },
    ]);
    expect(reading).toEqual({ line: null, destination: null });
  });

  it('takes neither a 1-digit nor a 5-digit number: no lines look like that', () => {
    const reading = guessBusReading([
      { text: '7', score: 0.9 },
      { text: '99999', score: 0.9 },
    ]);
    expect(reading.line).toBeNull();
  });
});

describe('phraseBusReading', () => {
  it('says number and destination together when both are there', () => {
    expect(phraseBusReading({ line: '427', destination: 'PORTONES' }, null)).toBe(
      `${strings.reader.line} 427, PORTONES`,
    );
  });

  it('falls back to the raw text before falling back to silence', () => {
    expect(phraseBusReading(null, 'DM 1234')).toBe('DM 1234');
  });

  it('with nothing legible, it says so — it does not make things up', () => {
    expect(phraseBusReading(null, null)).toBe(strings.reader.nothingRead);
  });
});

describe('phraseProduct', () => {
  it('says kind, brand and detail in that order: what discriminates most goes first', () => {
    expect(
      phraseProduct({ kind: 'arroz', brand: 'Saman', detail: 'Blue Patna 1 kg' }, null),
    ).toBe('arroz Saman, Blue Patna 1 kg');
  });

  it('without a detail it says kind and brand', () => {
    expect(phraseProduct({ kind: 'yerba', brand: 'Canarias', detail: null }, null)).toBe(
      'yerba Canarias',
    );
  });

  it('with an unreadable brand it still says the kind: that is what decides if the product is useful', () => {
    expect(phraseProduct({ kind: 'fideos', brand: null, detail: '500 g' }, null)).toBe(
      'fideos, 500 g',
    );
  });

  it('with an unreadable kind it still says the brand — each field falls on its own', () => {
    expect(phraseProduct({ kind: null, brand: 'Conaprole', detail: null }, null)).toBe(
      'Conaprole',
    );
  });

  it('with nothing legible it falls back to the raw text before silence', () => {
    expect(phraseProduct({ kind: null, brand: null, detail: null }, 'SAMAN 1 kg')).toBe(
      'SAMAN 1 kg',
    );
  });

  it('with nothing legible, it says so — it does not make things up', () => {
    expect(phraseProduct(null, null)).toBe(strings.reader.nothingReadProduct);
  });

  it('never speaks a bare `null`: the board said it out loud on 2026-09-11', () => {
    // Pointed at something that is not food, the model answered the literal `null`. The parser
    // rejected it (a JSON null is not a record) and the raw fallback read it out. This is that bug.
    expect(phraseProduct(null, 'null')).toBe(strings.reader.nothingReadProduct);
  });

  it('never speaks a JSON leftover as if it were a reading', () => {
    // Valid JSON in a shape the parser does not accept used to be announced field names and all.
    expect(phraseProduct(null, '{}')).toBe(strings.reader.nothingReadProduct);
    expect(phraseProduct(null, '{"producto": "arroz"}')).toBe(strings.reader.nothingReadProduct);
    expect(phraseProduct(null, '   ')).toBe(strings.reader.nothingReadProduct);
  });

  it('still speaks real prose the model wrote instead of JSON', () => {
    // The fallback's whole point, and it must survive the fix: an answer in words is useful, and
    // saying it beats admitting defeat.
    expect(phraseProduct(null, 'una lata de arvejas, marca no visible')).toBe(
      'una lata de arvejas, marca no visible',
    );
  });
});
