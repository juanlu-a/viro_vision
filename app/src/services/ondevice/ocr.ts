/**
 * OCR local: detecta regiones de texto en una foto y las lee.
 *
 * REGLA DE FRONTERA (ADR 0001): instrumentación de desarrollo mientras dure el spike. Cuando se
 * decida promoverlo al camino de reconocimiento, hay que sacarlo de acá y de la regla de lint.
 *
 * **Por qué OCR y no un modelo de visión generalista.** Leer "183 · Punta Carretas" de un cartel es
 * literalmente la tarea para la que existe un OCR. Un VLM hace eso *además* de describir la escena
 * y razonar sobre ella — capacidades que este producto no usa y que se pagan en memoria, batería y
 * latencia. Los números del spike lo vuelven concreto: el VLM multimodal más chico que encontramos
 * pide 3 GB y no logra cargar en el teléfono; este pipeline son ~250 MB y corre.
 *
 * **Esto no es "volver a YOLO + OCR".** Esa era la tarea B1 del roadmap: juntar y etiquetar un
 * dataset uruguayo, entrenar YOLO11, elegir un OCR. Acá los modelos vienen entrenados y listos: se
 * bajan y andan. Es quedarse con el resultado de ese camino sin pagar el entrenamiento.
 *
 * El detector devuelve **caja delimitadora** además del texto, y eso no es un detalle: la tesis
 * pide priorizar el ómnibus más relevante cuando hay varios, y la posición es lo que permite
 * hacerlo. Un VLM devolvería una frase, no coordenadas.
 */
import { OCR_SPANISH, OCRModule } from 'react-native-executorch';
import type { OCRDetection } from 'react-native-executorch';

export interface LecturaOcr {
  /** Todo lo que se detectó, ordenado de mayor a menor confianza. */
  detecciones: OCRDetection[];
  /** Milisegundos de la pasada, medidos acá para ser comparables con el resto del spike. */
  ms: number;
}

let modulo: OCRModule | null = null;

export function ocrCargado(): boolean {
  return modulo !== null;
}

/**
 * Descarga (la primera vez) y carga el pipeline de OCR en español.
 *
 * Español y no inglés porque el alfabeto cambia el reconocedor: los destinos llevan tildes y eñes
 * —"Punta Carretas", "Peñarol", "Estación"— y un reconocedor entrenado sin esos símbolos los
 * lee mal o los descarta.
 */
export async function cargarOcr(
  onProgress: (fraccion: number) => void,
): Promise<{ ms: number }> {
  liberarOcr();
  const t0 = performance.now();
  modulo = await OCRModule.fromModelName(OCR_SPANISH, onProgress);
  return { ms: performance.now() - t0 };
}

/** Lee el texto de una imagen. La ruta puede ser `file://…` o absoluta. */
export async function leerImagen(rutaImagen: string): Promise<LecturaOcr> {
  if (!modulo) throw new Error('El OCR no está cargado.');

  const t0 = performance.now();
  const detecciones = await modulo.forward(rutaImagen);
  const ms = performance.now() - t0;

  return {
    // Mayor confianza primero: es el orden en que un humano miraría los resultados, y el que
    // conviene para elegir qué anunciar cuando hay varios textos en la escena.
    detecciones: [...detecciones].sort((a, b) => b.score - a.score),
    ms,
  };
}

export function liberarOcr(): void {
  modulo?.delete();
  modulo = null;
}
