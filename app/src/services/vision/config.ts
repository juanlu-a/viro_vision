/**
 * Configuración de la visión en la nube (modo supermercado, ADR 0006 + ADR 0008), leída de env
 * vars públicas (ver app/.env.example).
 *
 * ⚠️ Las `EXPO_PUBLIC_*` se inlinean en el bundle en tiempo de build: un build compilado sin clave
 * no puede recuperarla en runtime, y —al revés— un build compilado CON clave la lleva legible
 * dentro del `.ipa`. Por eso el destino de las claves es el proxy de ADR 0008; este camino directo
 * queda como el de desarrollo, contra un `.env` local.
 *
 * Cuando no hay ninguna clave, el modo supermercado avisa que no está configurado en vez de
 * romper — mismo patrón que el stub de Supabase.
 */
import { isProxyConfigured } from '@/services/cloud';

import type { ModelProfile, VisionProviderId } from './types';

/** Gemini: tier gratuito sin tarjeta (aistudio.google.com). Es el default del modo. */
export const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

/** OpenAI: requiere crédito con tarjeta. */
export const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

/** Anthropic: requiere crédito con tarjeta (una suscripción a Claude NO habilita la API). */
export const anthropicApiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

/** Groq: tier gratuito sin tarjeta (console.groq.com). */
export const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';



const API_KEYS: Record<VisionProviderId, string> = {
  gemini: geminiApiKey,
  openai: openaiApiKey,
  anthropic: anthropicApiKey,
  groq: groqApiKey,
};

export const isGeminiConfigured = geminiApiKey.length > 0;
export const isOpenaiConfigured = openaiApiKey.length > 0;
export const isAnthropicConfigured = anthropicApiKey.length > 0;
export const isGroqConfigured = groqApiKey.length > 0;

export function apiKeyFor(provider: VisionProviderId): string {
  return API_KEYS[provider];
}

/**
 * Con el proxy activo, **todos** los proveedores están disponibles aunque el build no traiga
 * ninguna clave: precisamente porque las tiene el servidor. Sin esto, un build correcto —el que
 * queremos distribuir— mostraría el modo supermercado como "no configurado".
 *
 * Que el servidor tenga o no el secret de un proveedor concreto no se puede saber desde acá; si le
 * falta, la función responde 503 nombrando el secret que falta.
 */
export function isProviderConfigured(provider: VisionProviderId): boolean {
  return isProxyConfigured || apiKeyFor(provider).length > 0;
}

/** Sin proxy y sin ninguna clave, el modo supermercado no puede leer: la UI lo dice en vez de fallar. */
export const isVisionConfigured =
  isProxyConfigured || (Object.keys(API_KEYS) as VisionProviderId[]).some(isProviderConfigured);

export const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export const ANTHROPIC_VERSION = '2023-06-01';

export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/** Groq expone el dialecto de OpenAI bajo `/openai/v1`, con su propio host. */
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Los modelos que ofrece el selector de Inicio (sólo los de proveedores con clave). El orden es el
 * del selector.
 *
 * **Están elegidos por latencia medida, no por capacidad ni por catálogo**: el usuario está parado
 * frente a la góndola esperando escuchar qué agarró, y la lectura son tres campos cortos que no
 * necesitan un modelo grande. Los números que sostienen esta lista están en
 * `docs/mediciones/2026-09-02-modelos-supermercado.md`.
 *
 * **Son dos, y eso es deliberado.** El selector es un `radiogroup` que se recorre con VoiceOver:
 * cada opción de más es un swipe más entre la persona y la lectura. Dos opciones cubren la elección
 * real que existe —el equilibrado sin cuota apretada, y el más rápido con cuota apretada— y
 * cualquier tercera habría que justificarla contra ese costo.
 *
 * **Qué salió, y por qué se puede volver.** `gemini-3.5-flash-lite` (el default hasta el
 * 2026-09-02) salió por la medición: mediana 10 649 ms y rango 2820-32 586 ms, contra 1668 ms del
 * default actual. `claude-haiku-4-5` salió por no estar verificado y no tener clave;
 * `gemini-flash-lite-latest` y `claude-opus-5` habían salido el 2026-09-01 por el costo de
 * accesibilidad de un selector largo. **Los módulos de sus proveedores siguen acá**
 * (`providers/gemini.ts`, `providers/anthropic.ts`), verificados y con sus hallazgos comentados:
 * volver a ofrecer uno es agregar su perfil a esta lista, no reescribir código.
 *
 * El modelo hosteado en Arnaldo Castro está decidido pero **no implementado**: falta el endpoint
 * (ADR 0008).
 */
export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    // Default desde el 2026-09-02. No es el más rápido —Groq lo es— sino **el más rápido que
    // aguanta un recorrido de góndola**: la cuota gratuita de Groq son ~4 lecturas por minuto y
    // alguien eligiendo productos hace del orden de 2 a 4, así que como default chocaría el límite.
    //
    // Medido contra la API real (5 corridas, 2026-09-02): mediana 1668 ms, rango 1410-2490 ms, con
    // acierto de tipo, marca y detalle en todas. Cuesta ~USD 0,0003 por lectura (1138 tokens de
    // entrada + 35 de salida): mil lecturas, menos de medio dólar.
    //
    // Es un modelo de razonamiento y su default es `medium`. Se le manda `reasoning_effort: 'none'`
    // por intención, no por latencia: la medición mostró que en esta tarea da lo mismo (ver
    // `providers/openaiCompatible.ts`).
    provider: 'openai',
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna (equilibrado)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // El más rápido de los medidos y el único gratuito sin tarjeta que quedó: mediana 846 ms, rango
    // 764-1087 ms — la mitad que el default y con menos dispersión. No es el default por la cuota:
    // el tier gratuito limita por **tokens** por minuto (8000 TPM) y una foto cuesta ~1974 fijos, o
    // sea ~4 lecturas por minuto. Achicar la imagen no lo baja: Groq la cobra a tarifa plana.
    //
    // El interés para la tesis no es que sea otro modelo grande sino **otro hardware**: las LPU de
    // Groq contra las GPU de los propietarios. Que un modelo abierto de 27B les gane por 2x en
    // latencia es un resultado reportable.
    //
    // Es el 3.8 y no el 3.6, aun siendo éste más rápido en el papel (500 contra 450 tok/s): el 3.6
    // sólo admite `json_object`, que garantiza JSON sintáctico pero deja los nombres de campo a
    // criterio del modelo, y `parseProductoLeido` rebotaría una lectura correcta por venir como
    // "producto" en vez de "tipo". El 3.8 admite `json_schema` con `strict`. Ambos están en preview.
    provider: 'groq',
    id: 'qwen/qwen3.8-27b',
    label: 'Qwen 3.8 27B en Groq (el más rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
];

/**
 * Perfiles **retirados del selector**, cuyos proveedores siguen implementados y testeados.
 *
 * No es código muerto ni nostalgia: `providers/gemini.ts` y `providers/anthropic.ts` siguen en el
 * binario, con sus hallazgos comentados (el discriminador `event_type` de Gemini, el 400 de
 * `output_config.effort` en Haiku), y sus tests necesitan un perfil contra el cual armar el
 * request. Tenerlos acá hace que **volver a ofrecer uno sea mover una entrada a `MODEL_PROFILES`**,
 * en vez de reescribir un perfil de memoria y perder por el camino la medición que lo describe.
 *
 * Deliberadamente **no** los busca `findModelProfile`: un id retirado tiene que caer al default,
 * que es lo que hace `resolveProductoModel` con la preferencia guardada de alguien que eligió un
 * modelo que ya no está.
 */
export const PERFILES_RETIRADOS: readonly ModelProfile[] = [
  {
    // Fue el default hasta el 2026-09-02. Sale por la medición contra la API real: mediana
    // 10 649 ms con un rango de 2820 a 32 586 ms, contra 1668 ms del default actual. Lo que lo
    // descarta no es la mediana sino la dispersión — 11,6x entre el mejor y el peor caso, con la
    // cuota fresca y las corridas espaciadas. Conserva la mejor cuota de las tres (20/min) y la
    // peor latencia, así que si algún día la cuota pesara más que el tiempo, es el candidato.
    provider: 'gemini',
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // Nunca llegó a verificarse contra su API: requiere tarjeta y no hubo clave. No sale por malo,
    // sale por desconocido — es la tercera familia de modelos y sigue siendo el término de
    // comparación que ADR 0006 quería.
    provider: 'anthropic',
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
];

/** Sólo los modelos cuyo proveedor tiene clave cargada. */
export function availableModels(): readonly ModelProfile[] {
  return MODEL_PROFILES.filter((profile) => isProviderConfigured(profile.provider));
}

/** El primer modelo utilizable, o el primero del registro si no hay ninguna clave. */
export function defaultModel(): ModelProfile {
  return availableModels()[0] ?? MODEL_PROFILES[0];
}

export function findModelProfile(id: string): ModelProfile {
  return MODEL_PROFILES.find((profile) => profile.id === id) ?? defaultModel();
}
