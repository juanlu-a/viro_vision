/**
 * Gemma 4 E2B multimodal sobre ExecuTorch. La contraprueba del spike.
 *
 * REGLA DE FRONTERA (ADR 0001): instrumentación de desarrollo, prohibida en el camino de
 * reconocimiento. El linter lo fuerza.
 *
 * Existe para responder UNA pregunta: ¿la visión local falla por LiteRT-LM, o falla en el teléfono
 * en general? Mismo modelo (Gemma 4 E2B), mismo teléfono, otro runtime — en iOS ExecuTorch usa la
 * variante **MLX**, el stack de Apple, mientras LiteRT va por su delegado Metal propio. Si acá la
 * visión funciona, el problema era de la librería y se reporta; si falla igual, el límite es del
 * hardware/OS y la conclusión del ADR cambia.
 *
 * El TTFT se mide sobre el primer token del stream, igual que en la nube y en LiteRT: si cada
 * camino midiera distinto, la tabla comparativa de la tesis no significaría nada.
 */
import { GEMMA4_E2B_MM, LLMModule } from 'react-native-executorch';

/**
 * Dónde va la imagen dentro del prompt. Viene del `tokenizer_config.json` del modelo
 * (`image_token`): el runner reemplaza cada aparición por la imagen correspondiente, y exige que
 * haya tantos marcadores como imágenes — pasarle una imagen sin marcador es el error
 * "More image/audio paths provided than placeholders in prompt".
 */
const IMAGE_TOKEN = '<|image|>';

export interface EtCargaResultado {
  descargaYCargaMs: number;
}

export interface EtGeneracionResultado {
  texto: string;
  totalMs: number;
  /** Hasta el primer token con contenido. `null` si no hubo streaming. */
  ttftMs: number | null;
}

let modulo: LLMModule | null = null;
/** El callback de tokens se fija al crear el módulo; esta indirección permite medir por corrida. */
let onTokenActual: ((token: string) => void) | null = null;

export function etCargado(): boolean {
  return modulo !== null;
}

/** Descarga (~3 GB la primera vez) y carga el Gemma 4 multimodal. */
export async function etCargar(
  onProgress: (fraccion: number) => void,
): Promise<EtCargaResultado> {
  etLiberar();
  const t0 = performance.now();
  modulo = await LLMModule.fromModelName(
    GEMMA4_E2B_MM,
    onProgress,
    (token) => onTokenActual?.(token),
  );
  return { descargaYCargaMs: performance.now() - t0 };
}

/** Genera a partir de una imagen, con el mismo prompt que los otros caminos del spike. */
export async function etGenerarConImagen(
  prompt: string,
  rutaImagen: string,
): Promise<EtGeneracionResultado> {
  const llm = modulo;
  if (!llm) throw new Error('El modelo de ExecuTorch no está cargado.');

  let ttftMs: number | null = null;
  const t0 = performance.now();
  onTokenActual = (token) => {
    if (ttftMs === null && token.length > 0) ttftMs = performance.now() - t0;
  };
  try {
    // La imagen primero y el texto después, igual que en los otros dos caminos del spike.
    const texto = await llm.forward(`${IMAGE_TOKEN}\n${prompt}`, [rutaImagen]);
    return { texto, totalMs: performance.now() - t0, ttftMs };
  } finally {
    onTokenActual = null;
  }
}

export function etLiberar(): void {
  modulo?.delete();
  modulo = null;
}
