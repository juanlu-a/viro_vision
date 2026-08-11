/**
 * Configuración del benchmark de visión en la nube, leída de env vars públicas
 * (ver app/.env.example). Las EXPO_PUBLIC_* se inlinean en el bundle en tiempo de build:
 * un build de release compilado sin la clave no puede recuperarla en runtime.
 *
 * Cuando la clave está ausente, `isAnthropicConfigured` es false y la pantalla de benchmark
 * se muestra como "no configurada" en vez de romper — mismo patrón que el stub de Supabase.
 */
export const anthropicApiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export const isAnthropicConfigured = anthropicApiKey.length > 0;

export const ANTHROPIC_VERSION = '2023-06-01';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Capacidades por modelo. Existen porque la API **rechaza con 400** parámetros que un modelo
 * no soporta, así que el cuerpo de la request no puede ser el mismo para todos:
 *
 * - `supportsEffort`: `output_config.effort` da 400 en Haiku 4.5.
 * - `supportsAdaptiveThinking`: el thinking adaptativo existe desde la familia 4.6; en Haiku 4.5
 *   se omite el campo y el modelo responde sin razonar (que es lo que queremos para latencia).
 */
export interface ModelProfile {
  id: string;
  /** Etiqueta para la UI. */
  label: string;
  supportsEffort: boolean;
  supportsAdaptiveThinking: boolean;
  /** Techo de salida. La respuesta pedida son dos campos, así que alcanza muy poco. */
  maxTokens: number;
}

export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    // El más rápido de la familia. Prioridad velocidad sobre precisión.
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5 (más rápido)',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    maxTokens: 256,
  },
  {
    // Referencia de calidad, para contrastar contra el rápido.
    id: 'claude-opus-5',
    label: 'Opus 5 (más preciso)',
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    maxTokens: 512,
  },
];

/** Modelo por defecto: el más rápido. */
export const DEFAULT_MODEL_PROFILE = MODEL_PROFILES[0];

export function findModelProfile(id: string): ModelProfile {
  return MODEL_PROFILES.find((profile) => profile.id === id) ?? DEFAULT_MODEL_PROFILE;
}
