/**
 * La frontera con la nube: por dónde sale un pedido y con qué claves (ADR 0008).
 *
 * Único punto de import: `@/services/cloud`. Lo usan `services/vision` (lectura de producto) y
 * `services/audio` (síntesis de voz a archivo), que no se conocen entre sí.
 */
export { isProxyConfigured, proxyUrl } from './config';
export { resolverTransporte } from './transport';
export type { CloudProviderId, CloudRequest } from './types';
