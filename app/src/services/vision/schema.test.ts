/**
 * Exists because the voice depends on this: if the parser rejects valid JSON the user hears the raw
 * text instead of the product; if it accepts garbage, they hear garbage. The cases come from real
 * answers: ```json blocks, truncation by max_tokens, empty text.
 */
import { parseJsonRecord } from './schema';

describe('parseJsonRecord', () => {
  it('parses a flat JSON object', () => {
    expect(parseJsonRecord('{"kind":"Yerba","detail":null}')).toEqual({ kind: 'Yerba', detail: null });
  });

  it('tolerates the model wrapping the JSON in a code block', () => {
    expect(parseJsonRecord('```json\n{"kind":"Arroz"}\n```')).toEqual({ kind: 'Arroz' });
  });

  it('returns null on truncated JSON (for example stop_reason max_tokens)', () => {
    expect(parseJsonRecord('{"kind":"Arro')).toBeNull();
  });

  it('returns null when it is not an object (array, number, empty text)', () => {
    expect(parseJsonRecord('[1,2]')).toBeNull();
    expect(parseJsonRecord('42')).toBeNull();
    expect(parseJsonRecord('   ')).toBeNull();
  });
});
