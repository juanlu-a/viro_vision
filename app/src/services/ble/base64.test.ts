/**
 * Exists because everything the app tells the device and everything the device answers goes through
 * here: the mode being written, the `status` JSON, the WiFi credentials and the MP3 uploaded to the
 * speaker. Mis-computed padding breaks nothing visibly — it produces bytes the device interprets as
 * something else.
 */
import {
  encodeBase64,
  encodeTextBase64,
  decodeBase64,
  decodeTextBase64,
} from './base64';

describe('base64', () => {
  it('round-trips arbitrary bytes, including 1- and 2-byte padding', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 182]) {
      const bytes = new Uint8Array(Array.from({ length }, (_, i) => (i * 37 + 11) & 0xff));
      expect(Array.from(decodeBase64(encodeBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('matches the standard base64 the device produces', () => {
    expect(encodeTextBase64('{"cmd":"photo"}')).toBe('eyJjbWQiOiJwaG90byJ9');
    expect(decodeTextBase64('eyJ0IjoibW9kZSJ9')).toBe('{"t":"mode"}');
  });
});
