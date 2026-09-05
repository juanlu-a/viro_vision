/**
 * La foto sacada por la cámara de la placa, bajada por WiFi (ADR 0003, plan B).
 *
 * `GET /fotos/ultima` captura en la placa y devuelve el JPEG ya a 1024 px y calidad 70: el mismo
 * tamaño que `prepararParaLaNube` produce con la cámara del teléfono, así que no se vuelve a
 * reescalar. Se guarda en caché con `uri` para el OCR local (que lee archivos) y se devuelve el
 * base64 para la nube, que es lo único que necesita el modo supermercado.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { codificarBase64 } from '@/services/ble/transferencia';
import { HttpDescargaError, urlDeLaPlaca } from '@/services/wifi/descargaHttp';

import type { ImagenParaLaNube } from './captura';

const CARPETA = 'fotos-placa';

export interface FotoDeLaPlaca {
  uri: string;
  imagen: ImagenParaLaNube;
  bytes: number;
  /** Del pedido al último byte, captura incluida. */
  ms: number;
}

interface Deps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  guardar?: (bytes: Uint8Array) => string;
}

function guardarEnCache(bytes: Uint8Array): string {
  const carpeta = new Directory(Paths.cache, CARPETA);
  if (!carpeta.exists) carpeta.create({ idempotent: true });
  const archivo = new File(carpeta, `placa-${Date.now()}.jpg`);
  archivo.create({ overwrite: true });
  archivo.write(bytes);
  return archivo.uri;
}

export async function descargarFotoDeLaPlaca(
  direccion: { ip: string; puerto: number },
  { fetchImpl = fetch, now = Date.now, timeoutMs = 20_000, guardar = guardarEnCache }: Deps = {}
): Promise<FotoDeLaPlaca> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  const t0 = now();
  let respuesta: Response;
  try {
    respuesta = await fetchImpl(urlDeLaPlaca(direccion, '/fotos/ultima'), { signal: controlador.signal, cache: 'no-store' });
  } catch (err) {
    clearTimeout(timer);
    throw new HttpDescargaError(controlador.signal.aborted ? `la placa no respondió en ${timeoutMs / 1000} s` : err instanceof Error ? err.message : String(err));
  }
  if (!respuesta.ok) {
    clearTimeout(timer);
    // 503 = la placa no tiene cámara; lo dice ella y la UI lo puede distinguir.
    throw new HttpDescargaError(respuesta.status === 503 ? 'la placa no tiene cámara' : `la placa respondió ${respuesta.status}`, respuesta.status);
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await respuesta.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
  const ms = Math.max(1, now() - t0);
  return {
    uri: guardar(bytes),
    imagen: { imageBase64: codificarBase64(bytes), mediaType: 'image/jpeg' },
    bytes: bytes.length,
    ms,
  };
}
