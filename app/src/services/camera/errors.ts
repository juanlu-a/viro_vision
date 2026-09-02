/**
 * Errores tipados de la captura de imagen.
 *
 * Mismo criterio que `services/vision/errors.ts`: la UI elige qué anunciar por el TIPO del error,
 * nunca parseando strings, y el dato accionable viaja como campo de la clase. Acá el dato es si
 * todavía se puede volver a pedir el permiso, porque cambia el consejo que se le da al usuario:
 * "aceptá el permiso" no sirve cuando iOS ya no va a volver a preguntar.
 */

/** El usuario no dio permiso de cámara (o iOS ya no vuelve a preguntar). */
export class CameraPermissionError extends Error {
  /** false cuando el sistema no volverá a mostrar el diálogo: hay que ir a Ajustes. */
  readonly canAskAgain: boolean;

  constructor(canAskAgain: boolean) {
    super('CAMERA_PERMISSION_DENIED');
    this.name = 'CameraPermissionError';
    this.canAskAgain = canAskAgain;
  }
}

/**
 * El redimensionado no devolvió los bytes de la imagen. No debería pasar —se pide `base64: true`—
 * pero si pasara, mandar `undefined` a la nube da un 400 críptico en vez de un mensaje que el
 * usuario pueda entender.
 */
export class ImagenIlegibleError extends Error {
  constructor() {
    super('IMAGEN_ILEGIBLE');
    this.name = 'ImagenIlegibleError';
  }
}
