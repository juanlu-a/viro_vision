/**
 * Configuración de la visión en la nube (modo supermercado, ADR 0006), leída de env vars públicas
 * (ver app/.env.example). Las EXPO_PUBLIC_* se inlinean en el bundle en tiempo de build: un build
 * compilado sin clave no puede recuperarla en runtime.
 *
 * Cuando no hay ninguna clave, el modo supermercado avisa que no está configurado en vez de
 * romper — mismo patrón que el stub de Supabase. Cómo despliega la clave un build distribuible
 * sin credenciales del usuario sigue pendiente en ADR 0006.
 */
import type { ModelProfile, VisionProviderId } from './types';

/**
 * Gemini es el proveedor primario: tiene tier gratuito sin tarjeta — la restricción dura de
 * ADR 0006 es que el modelo sea gratuito para el usuario.
 */
export const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

/** Anthropic queda como segundo proveedor opcional, para contrastar contra otra familia. */
export const anthropicApiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export const isGeminiConfigured = geminiApiKey.length > 0;
export const isAnthropicConfigured = anthropicApiKey.length > 0;

/** Si no hay ninguna clave, el modo supermercado no puede leer: la UI lo dice en vez de fallar. */
export const isVisionConfigured = isGeminiConfigured || isAnthropicConfigured;

export function apiKeyFor(provider: VisionProviderId): string {
  return provider === 'gemini' ? geminiApiKey : anthropicApiKey;
}

export function isProviderConfigured(provider: VisionProviderId): boolean {
  return apiKeyFor(provider).length > 0;
}

export const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Modelos que ofrece el selector de Inicio (sólo los de proveedores con clave). El orden es el
 * del selector.
 *
 * De Gemini van sólo los Flash Lite: los Flash grandes tardan un orden de magnitud más por
 * lectura (ver el comentario del default), y un modelo que tarda medio minuto en decir "arroz
 * Saman" no es una opción para alguien parado frente a la góndola. Los de Anthropic aparecen
 * únicamente si el build trae su clave — hoy ninguno lo hace.
 */
export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    // Default. Medido contra la API real (30/08/2026, foto de un paquete de arroz): con la cuota
    // fresca el Lite responde en 2-3 s, mientras gemini-3.5-flash da 17-30 s y gemini-3.6-flash
    // —que era el default anterior— 34-47 s. La brecha es el paso de 'thought': los grandes piensan
    // aunque no haga falta para tres campos cortos. El Lite acertó tipo, marca y detalle en TODAS
    // las corridas, así que la latencia del grande no compra precisión.
    //
    // Cuidado al re-medir: sostener pedidos satura el tier gratuito y a partir de la tercera
    // lectura seguida cualquier modelo salta a 20-80 s. Eso es la cuota, no el modelo — para
    // comparar modelos hay que espaciar las corridas. El Lite además tiene su **propia** cuota,
    // separada de la de Flash.
    provider: 'gemini',
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite (rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // El alias: Google lo mueve al Flash Lite vigente sin que haya que publicar una versión de la
    // app. Está para poder contrastar el modelo fijado contra el que Google considera actual — si
    // el alias adelanta al fijado, es la señal para actualizar el de arriba.
    provider: 'gemini',
    id: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite (última)',
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
    provider: 'anthropic',
    id: 'claude-opus-5',
    label: 'Opus 5 (preciso)',
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    maxTokens: 512,
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
