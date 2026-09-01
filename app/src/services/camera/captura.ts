/**
 * La captura de imagen del lector: sacar la foto y dejarla lista para el modelo.
 *
 * En el producto la foto la saca la placa del dispositivo y llega al teléfono por BLE/WiFi (ver el
 * diagrama en `docs/architecture/README.md`). Mientras no hay hardware, **la cámara del teléfono
 * ocupa ese lugar** y el resto del flujo es idéntico — por eso el modo supermercado se puede
 * desarrollar y evaluar hoy.
 *
 * Se usa la cámara del sistema vía `expo-image-picker` y no una vista propia con `expo-camera`: la
 * UI de cámara nativa ya está resuelta para VoiceOver (obturador etiquetado, anuncios de encuadre),
 * y la convención de accesibilidad de esta base prefiere el componente estándar bien anotado sobre
 * la UI dibujada a mano.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { CameraPermissionError, ImagenIlegibleError } from './errors';
import { calcularRedimension } from './redimension';

/**
 * De dónde sale la imagen. La cámara es el flujo real; la fototeca existe para poder pasarle **la
 * misma foto** a los cinco modelos del selector y que la comparación mida modelos y no fotos — es
 * el insumo del dataset de evaluación (ADR 0006).
 */
export type FuenteDeImagen = 'camara' | 'fototeca';

export interface FotoCapturada {
  uri: string;
  width: number;
  height: number;
}

/** La imagen tal como la espera el modelo de la nube: base64 sin el prefijo `data:`. */
export interface ImagenParaLaNube {
  imageBase64: string;
  /** Siempre JPEG: el redimensionado normaliza el formato, así que el modo ya no depende del origen. */
  mediaType: 'image/jpeg';
}

/** `null` cuando el usuario canceló — cancelar no es un error y no se anuncia como tal. */
export async function capturarFoto(fuente: FuenteDeImagen): Promise<FotoCapturada | null> {
  if (fuente === 'camara') {
    // El permiso se pide explícitamente para poder anunciar el rechazo. Dejar que `launchCameraAsync`
    // falle solo deja al usuario sin cámara y sin explicación, y acá la voz es la única interfaz.
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) throw new CameraPermissionError(permiso.canAskAgain);
  }

  // No se pide `base64` acá aunque la nube lo necesite: sobre una foto de cámara son megabytes de
  // string cruzando el puente JS para descartarlos enseguida al redimensionar. El base64 sale de
  // `prepararParaLaNube`, ya sobre la imagen chica.
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const resultado =
    fuente === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);

  const asset = resultado.assets?.[0];
  if (resultado.canceled || !asset) return null;

  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/**
 * Achica la foto y devuelve el base64 que viaja a la nube.
 *
 * Sólo lo usa el modo supermercado: el modo ómnibus corre el OCR local contra el `uri` y no
 * necesita ni el base64 ni el reescalado (ADR 0006).
 */
export async function prepararParaLaNube(foto: FotoCapturada): Promise<ImagenParaLaNube> {
  const contexto = ImageManipulator.manipulate(foto.uri);
  const redimension = calcularRedimension(foto.width, foto.height);
  if (redimension) contexto.resize(redimension);

  const render = await contexto.renderAsync();
  const salida = await render.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

  if (!salida.base64) throw new ImagenIlegibleError();
  return { imageBase64: salida.base64, mediaType: 'image/jpeg' };
}
