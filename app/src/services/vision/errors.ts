/**
 * Typed errors of the cloud vision layer (supermarket mode, ADR 0006).
 *
 * The UI decides what message to show and what to announce by voice from the error's TYPE, never by
 * parsing strings — and when an error carries actionable data (how long to wait, what failed), it
 * travels as a field.
 */

/** Thrown when the chosen model's provider has no key (see app/.env.example). */
export class VisionNotConfiguredError extends Error {
  constructor() {
    super('VISION_NOT_CONFIGURED');
    this.name = 'VisionNotConfiguredError';
  }
}

/** Thrown on a non-2xx HTTP response. `body` carries the API's detail. */
export class VisionHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`VISION_HTTP_${status}`);
    this.name = 'VisionHttpError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Quota exhausted. It is set apart from the rest because **it is expected and resolves by waiting**:
 * Gemini's free tier allows 20 requests per minute per model. The provider reports how long to wait
 * and that figure is kept so it can be told to the user.
 */
export class VisionQuotaError extends Error {
  readonly retryAfterSeconds: number;

  constructor(detail: string, retryAfterSeconds: number) {
    super(detail);
    this.name = 'VisionQuotaError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Thrown on an error event mid-stream (it arrives with HTTP 200). */
export class VisionStreamError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('VISION_STREAM_ERROR');
    this.name = 'VisionStreamError';
    this.detail = detail;
  }
}

/**
 * The network failed before the provider answered (no signal, DNS, TLS). `expo/fetch` rejects with
 * a generic `TypeError`; wrapping it lets the UI announce "no connection" instead of a technical
 * message — and lets supermarket mode degrade to a labelled state (ADR 0001).
 */
export class VisionNetworkError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('VISION_NETWORK_ERROR');
    this.name = 'VisionNetworkError';
    this.detail = detail;
  }
}
