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
 * **Están elegidos por latencia, no por capacidad**: el usuario está parado frente a la góndola
 * esperando escuchar qué agarró, y la lectura son tres campos cortos que no necesitan un modelo
 * grande. Por eso van los escalones más chicos de cada familia y ninguno de los grandes.
 *
 * Son cinco a propósito y no siete (salieron `gemini-flash-lite-latest` y `claude-opus-5`): el
 * selector es un `radiogroup` que se recorre con VoiceOver, y cada opción de más es un swipe más
 * entre la persona y la lectura (ADR 0006, actualización 2026-09-01). El quinto —el modelo
 * hosteado en Arnaldo Castro— está decidido pero **no implementado**: falta el endpoint (ADR 0008).
 */
export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    // Default. Medido contra la API real (30/08/2026, foto de un paquete de arroz): con la cuota
    // fresca responde en 2-3 s, mientras gemini-3.5-flash da 17-30 s y gemini-3.6-flash 34-47 s.
    // La brecha es el paso de 'thought': los grandes piensan aunque no haga falta para tres campos
    // cortos. El Lite acertó tipo, marca y detalle en TODAS las corridas, así que la latencia del
    // grande no compra precisión.
    //
    // Cuidado al re-medir: sostener pedidos satura el tier gratuito y a partir de la tercera
    // lectura seguida cualquier modelo salta a 20-80 s. Eso es la cuota, no el modelo.
    provider: 'gemini',
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite (rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // El escalón más chico de la familia vigente de OpenAI. Es un modelo de razonamiento y su
    // default es `medium`: el proveedor manda `reasoning_effort: 'none'`, sin lo cual pensaría
    // antes de devolver tres campos y la lectura pasaría a decenas de segundos.
    provider: 'openai',
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna (rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    provider: 'anthropic',
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5 (rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // El caso interesante del experimento: no es otro modelo grande sino **otro hardware** (las
    // LPU de Groq, ~450 tok/s). Si un modelo abierto de 27B sobre silicio dedicado le gana en
    // latencia a los propietarios, es un resultado que la tesis quiere reportar.
    //
    // Es el 3.8 y no el 3.6 aun siendo éste más rápido en el papel (500 vs 450 tok/s): el 3.6 sólo
    // admite `json_object`, que garantiza JSON sintáctico pero deja los nombres de campo a criterio
    // del modelo, y `parseProductoLeido` rebotaría una lectura correcta por venir como "producto"
    // en vez de "tipo". El 3.8 admite `json_schema` con `strict`. Sobre una respuesta de ~50 tokens
    // esos 50 tok/s son centésimas; la garantía de forma vale más. Los dos están en preview en
    // Groq: hay que medirlo antes de darlo por bueno.
    provider: 'groq',
    id: 'qwen/qwen3.8-27b',
    label: 'Qwen 3.8 27B en Groq (LPU)',
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
