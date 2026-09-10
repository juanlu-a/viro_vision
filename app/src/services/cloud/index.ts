/**
 * The boundary with the cloud: where a request goes out and with which keys (ADR 0008).
 *
 * Single import surface: `@/services/cloud`. It is used by `services/vision` (product reading) and
 * `services/audio` (speech synthesis to file), which do not know about each other.
 */
export { isProxyConfigured, proxyUrl } from './config';
export { resolveTransport } from './transport';
export type { CloudProviderId, CloudRequest } from './types';
