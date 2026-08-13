/**
 * Sonda de viabilidad: ¿el runtime local siquiera arranca en este teléfono?
 *
 * REGLA DE FRONTERA (ADR 0001, nota 2026-08-10): instrumentación de desarrollo. No es el camino de
 * reconocimiento y nada de `features/recognition/` ni `features/audio/` puede importarla.
 *
 * **No carga ningún modelo.** Es a propósito: bajar 2,59 GB para descubrir que el módulo nativo no
 * enlazó sería pagar el paso caro para responder la pregunta barata. Acá se responden, en orden y
 * sin descargar nada:
 *
 *   1. ¿El módulo nativo existe? Si el codegen de Nitro no enlazó contra RN 0.86, esto tira.
 *   2. ¿Cuánta memoria da el sistema *hoy*, en este teléfono? Es el número que predice si el
 *      modelo va a entrar, y sale de `os_proc_available_memory` (consciente del jetsam de iOS).
 *   3. ¿Qué backend recomienda, y hay algún bloqueo de multimodal a nivel plataforma?
 *   4. Con esos datos, la estimación pura de memoria para las dos configuraciones candidatas.
 */
import {
  checkBackendSupport,
  checkMultimodalSupport,
  createLLM,
  estimateMemory,
  getRecommendedBackend,
} from 'react-native-litert-lm';
import type { Backend, MemoryEstimate } from 'react-native-litert-lm';

import { CONFIGURACIONES, GEMMA_4_E2B_BYTES, MAX_CONTEXT_TOKENS } from './config';

export interface EstimacionPorBackend {
  backend: Backend;
  label: string;
  /** `null` si la estimación misma falló, para distinguirlo de "estimó que no entra". */
  estimacion: MemoryEstimate | null;
  error: string | null;
}

export interface ResultadoSonda {
  /** El módulo nativo respondió. Si es false, el resto no significa nada. */
  nativoDisponible: boolean;
  /** Memoria que el sistema dice que hay disponible ahora mismo, en bytes. */
  memoriaDisponibleBytes: number | null;
  backendRecomendado: Backend | null;
  /** Advertencia del backend, si la hay. No es un error: el backend puede andar igual. */
  avisoBackend: string | null;
  /** Mensaje si multimodal está bloqueado a nivel plataforma. `null` = no hay bloqueo. */
  bloqueoMultimodal: string | null;
  estimaciones: EstimacionPorBackend[];
  /** Qué falló, si la sonda no llegó a completarse. */
  error: string | null;
}

/** Nunca tira: el fallo *es* el resultado que la sonda busca medir. */
export async function sondearRuntime(): Promise<ResultadoSonda> {
  const base: ResultadoSonda = {
    nativoDisponible: false,
    memoriaDisponibleBytes: null,
    backendRecomendado: null,
    avisoBackend: null,
    bloqueoMultimodal: null,
    estimaciones: [],
    error: null,
  };

  let disponible: number;
  try {
    // Primer contacto con el módulo nativo. Si el codegen de Nitro no enlazó, muere acá — que es
    // exactamente lo que la sonda quiere averiguar antes de tocar un modelo.
    const llm = createLLM();
    const uso = llm.getMemoryUsage();
    disponible = uso.availableMemoryBytes;
  } catch (err) {
    return { ...base, error: describir(err) };
  }

  const recomendado = intentar(() => getRecommendedBackend());
  const bloqueo = intentar(() => checkMultimodalSupport() ?? null);

  const estimaciones = CONFIGURACIONES.map(({ backend, label }) => {
    try {
      return {
        backend: backend as Backend,
        label,
        estimacion: estimateMemory({
          modelFileSizeBytes: GEMMA_4_E2B_BYTES,
          availableMemoryBytes: disponible,
          config: { backend: backend as Backend, maxContextTokens: MAX_CONTEXT_TOKENS },
        }),
        error: null,
      };
    } catch (err) {
      return { backend: backend as Backend, label, estimacion: null, error: describir(err) };
    }
  });

  return {
    nativoDisponible: true,
    memoriaDisponibleBytes: disponible,
    backendRecomendado: recomendado ?? null,
    avisoBackend: recomendado ? (intentar(() => checkBackendSupport(recomendado)) ?? null) : null,
    bloqueoMultimodal: bloqueo ?? null,
    estimaciones,
    error: null,
  };
}

/** Una consulta accesoria que falle no puede tumbar la sonda entera. */
function intentar<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function describir(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
