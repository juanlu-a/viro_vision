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
    // `sendMessage` y no `forward`: forward manda el texto CRUDO, sin la plantilla de chat de
    // Gemma (<start_of_turn> y compañía), y el modelo responde con un fin-de-turno inmediato —
    // generación de 3 s con texto vacío, medido en el teléfono. sendMessage aplica la plantilla y
    // coloca la imagen solo.
    const historia = await llm.sendMessage(prompt, { imagePath: rutaImagen });
    const respuesta = [...historia].reverse().find((m) => m.role === 'assistant');
    return { texto: respuesta?.content ?? '', totalMs: performance.now() - t0, ttftMs };
  } finally {
    onTokenActual = null;
  }
}

/**
 * Borra la conversación acumulada. `sendMessage` guarda historia, y en un benchmark cada corrida
 * debe arrancar igual que la anterior: con historia acumulada, la segunda corrida re-procesa la
 * primera y los tiempos dejan de ser comparables.
 */
export function etReiniciarConversacion(): void {
  try {
    modulo?.deleteMessage(0);
  } catch {
    // Sin historia que borrar: no es un error.
  }
}

export function etLiberar(): void {
  modulo?.delete();
  modulo = null;
}
