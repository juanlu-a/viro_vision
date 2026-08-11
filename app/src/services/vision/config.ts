/**
 * Configuración del benchmark de visión en la nube, leída de env vars públicas
 * (ver app/.env.example). Las EXPO_PUBLIC_* se inlinean en el bundle en tiempo de build.
 *
 * Cuando la clave está ausente, `isAnthropicConfigured` es false y la pantalla de benchmark
 * se muestra como "no configurada" en vez de romper — mismo patrón que el stub de Supabase.
 */
export const anthropicApiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export const isAnthropicConfigured = anthropicApiKey.length > 0;

/** Modelo por defecto del benchmark. Es un eje del experimento: cambialo para comparar. */
export const VISION_MODEL = 'claude-opus-5';

export const ANTHROPIC_VERSION = '2023-06-01';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
