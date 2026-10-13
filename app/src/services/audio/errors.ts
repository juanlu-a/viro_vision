/**
 * Typed errors of speech-synthesis-to-file.
 *
 * Same criterion as in `services/vision/errors.ts`: the caller decides what to do from the TYPE, not
 * by parsing strings, and the actionable datum travels as a field. Here the reason matters because it
 * separates "it is off on purpose" from "it is on and it broke": the first is not a failure and is
 * not reported as one.
 */

/** Synthesis is not enabled, or there is neither a key nor a proxy to ask with. */
export class SpeechNotConfiguredError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super('SPEECH_NOT_CONFIGURED');
    this.name = 'SpeechNotConfiguredError';
    this.reason = reason;
  }
}

/** The TTS answered with a non-2xx status. `body` carries the API's detail. */
export class SpeechHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`SPEECH_HTTP_${status}`);
    this.name = 'SpeechHttpError';
    this.status = status;
    this.body = body;
  }
}
