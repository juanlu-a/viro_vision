/**
 * Superficie pública del spike de inferencia local (ADR 0004).
 *
 * REGLA DE FRONTERA (ADR 0001, nota 2026-08-10): instrumentación de desarrollo. Está prohibido
 * importar esto desde `features/recognition/` o `features/audio/` — el camino cámara →
 * detección/OCR → anuncio tiene que funcionar sin depender de un experimento a medio validar.
 */
export {
  CONFIGURACIONES,
  GEMMA_4_E2B_BYTES,
  GEMMA_4_E2B_URL,
  isOnDeviceSpikeEnabled,
  MAX_CONTEXT_TOKENS,
} from './config';
export { sondearRuntime } from './probe';
export type { EstimacionPorBackend, ResultadoSonda } from './probe';
export {
  cargarModelo,
  descargarModelo,
  generarConImagen,
  generarTexto,
  modeloCargado,
} from './runner';
export type { CargaResultado, GeneracionResultado } from './runner';
