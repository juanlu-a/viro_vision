/**
 * Captura de imagen del lector: la cámara del teléfono ocupando el lugar de la placa del
 * dispositivo mientras no hay hardware (ver `docs/architecture/README.md`).
 *
 * Barrel puro: única superficie de import (`@/services/camera`).
 */
export { capturarFoto, prepararParaLaNube } from './captura';
export type { FotoCapturada, FuenteDeImagen, ImagenParaLaNube } from './captura';
export { CameraPermissionError, ImagenIlegibleError } from './errors';
export { calcularRedimension, LADO_MAYOR_MAX } from './redimension';
export type { Redimension } from './redimension';
