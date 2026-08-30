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
 */
export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    // Default: el más liviano y rápido. Además tiene su **propia** cuota, separada de la de
    // Flash, así que alternar entre ambos duplica el presupuesto de requests por minuto.
    provider: 'gemini',
    id: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite (gratis)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    provider: 'gemini',
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash (gratis)',
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
