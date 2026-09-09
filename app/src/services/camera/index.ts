/**
 * La imagen del lector: la saca la cámara de la placa y baja por WiFi (ADR 0003).
 *
 * Hasta el 2026-09-08 acá vivía además la cámara del teléfono (`expo-image-picker`), que ocupaba
 * ese lugar mientras no había hardware, y la fototeca, que servía para pasarle la misma foto a
 * varios modelos. Las dos se fueron con el hardware andando: la única fuente de imagen del producto
 * es el dispositivo, y sostener una segunda dejaba `expo-image-picker` y los permisos de cámara y
 * fotos en el binario para un camino que ya nadie recorre.
 *
 * Barrel puro: única superficie de import (`@/services/camera`).
 */
export { descargarFotoDeLaPlaca } from './fotoDeLaPlaca';
export type { FotoDeLaPlaca, ImagenParaLaNube } from './fotoDeLaPlaca';
