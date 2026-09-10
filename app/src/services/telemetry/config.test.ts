/**
 * Exists because this fails **silently in both directions**.
 *
 * If the derivation does not work, a build that has the proxy configured but not its own secret
 * ships with no telemetry at all: the app works the same, nobody notices anything, and the hole only
 * shows up when a failure needs diagnosing and there is not a single row. And if it derived too
 * eagerly —force-assembling a URL out of something that is not the proxy's— every batch would 404
 * against an endpoint that does not exist, with the same visible result: zero rows.
 *
 * Both URLs come in as parameters, not from `process.env`: a test that reads the environment
 * measures where it runs and not what the code does (the lesson of the TestFlight failure of
 * 2026-09-02).
 */
import { resolveTelemetryUrl, telemetryUrlFrom } from './config';

const PROXY = 'https://oxukvenxiqkjhksgoigq.supabase.co/functions/v1/vision';
const TELEMETRY = 'https://oxukvenxiqkjhksgoigq.supabase.co/functions/v1/telemetry';

describe('telemetryUrlFrom', () => {
  it('swaps the last segment: the two functions live in the same project', () => {
    expect(telemetryUrlFrom(PROXY)).toBe(TELEMETRY);
  });

  it('tolerates the trailing slash, which is how a URL gets pasted from the dashboard', () => {
    expect(telemetryUrlFrom(`${PROXY}/`)).toBe(TELEMETRY);
  });

  it('does not guess: anything not ending in /vision derives nothing', () => {
    // A force-assembled URL would 404 on every batch and fill the queue with retries against an
    // endpoint that does not exist. Off and known beats on and broken.
    expect(telemetryUrlFrom('https://example.test/functions/v1/other')).toBeNull();
    expect(telemetryUrlFrom('https://example.test')).toBeNull();
    expect(telemetryUrlFrom('')).toBeNull();
    expect(telemetryUrlFrom(undefined)).toBeNull();
  });

  it('does not confuse a host ENDING in vision with the function path', () => {
    expect(telemetryUrlFrom('https://vision')).toBeNull();
  });
});

describe('resolveTelemetryUrl', () => {
  it('our own variable wins: it allows pointing at another project without touching the proxy', () => {
    expect(resolveTelemetryUrl('https://other.test/telemetry', PROXY)).toBe(
      'https://other.test/telemetry'
    );
  });

  it('with no variable of its own, it derives it from the proxy', () => {
    expect(resolveTelemetryUrl('', PROXY)).toBe(TELEMETRY);
    expect(resolveTelemetryUrl(undefined, PROXY)).toBe(TELEMETRY);
  });

  it('with neither of the two it returns empty, which turns telemetry off entirely', () => {
    expect(resolveTelemetryUrl('', '')).toBe('');
    expect(resolveTelemetryUrl(undefined, undefined)).toBe('');
  });
});
