/**
 * Exists because the error's text is now read only in the telemetry table (2026-10-06): if this
 * returned `[object Object]` or an empty string, the one place left to diagnose a failure would say
 * nothing — and nobody would notice until a field session needed it.
 */
import { errorDetail, errorType } from './errorDetail';

describe('errorDetail', () => {
  it('uses the message of an Error', () => {
    expect(errorDetail(new Error('boom'))).toBe('boom');
  });

  it('falls back to the name when the message is empty', () => {
    const err = new TypeError('');
    expect(errorDetail(err)).toBe('TypeError');
  });

  it('serializes plain objects instead of printing [object Object]', () => {
    expect(errorDetail({ code: 42 })).toBe('{"code":42}');
  });

  it('survives values JSON cannot serialize', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(errorDetail(cyclic)).toBe('[object Object]');
    expect(errorDetail(undefined)).toBe('undefined');
  });

  it('caps the length so a long body cannot get the row trimmed', () => {
    expect(errorDetail('x'.repeat(5_000))).toHaveLength(500);
  });
});

describe('errorType', () => {
  it('names the class, or the typeof for anything else', () => {
    expect(errorType(new RangeError('x'))).toBe('RangeError');
    expect(errorType('x')).toBe('string');
  });
});
