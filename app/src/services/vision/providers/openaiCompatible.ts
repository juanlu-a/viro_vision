/**
 * Proveedor de **dialecto OpenAI**: un solo módulo para OpenAI y Groq (y mañana para el modelo
 * que hosteemos nosotros — ver [ADR 0008]).
 *
 * Los tres hablan el mismo protocolo —`POST /v1/chat/completions`, `Authorization: Bearer`,
 * imagen como data URI en un content part `image_url`, deltas en `choices[0].delta.content`— así
 * que se parametriza por URL en vez de escribir tres proveedores casi idénticos. vLLM, Ollama y
 * TGI exponen ese mismo dialecto, que es la razón por la que sumar el endpoint de Arnaldo Castro
 * va a ser configuración y no código.
 *
 * Módulo puro: arma y traduce, no toca la red. Ver openaiCompatible.test.ts.
 */
import type {
  BuildRequestInput,
  ProviderEvent,
  ProviderRequest,
  TokenUsage,
  VisionProvider,
  VisionProviderId,
} from '../types';

/**
 * Traduce nuestro `ThinkingMode`/`EffortLevel` al parámetro del dialecto.
 *
 * **Esto es lo que decide la latencia del modo, igual que en Gemini.** `gpt-5.6-luna` es un modelo
 * de razonamiento y su default es `medium`: sin mandar nada, pensaría antes de devolver tres campos
 * cortos y la lectura pasaría de segundos a decenas de segundos. Es exactamente la trampa que en
 * Gemini costó descubrir (ver el comentario de `generation_config.thinking_level` en gemini.ts).
 *
 * OJO al agregar un modelo: el juego de valores NO es el mismo en los dos proveedores. OpenAI
 * acepta `none | low | medium | high | xhigh | max`; Groq, sólo `none | default`. `'none'` es el
 * único que los dos entienden, y es el que usa el modo supermercado. Si alguna vez hace falta
 * pensar, hay que mapear por proveedor, no copiar esta línea.
 */
function reasoningEffort(input: BuildRequestInput): string {
  return input.thinking === 'off' ? 'none' : input.effort;
}

function buildRequest(url: string, input: BuildRequestInput): ProviderRequest {
  return {
    url,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body: {
      model: input.model.id,
      stream: true,
      // Sin esto el stream no trae el uso de tokens en ningún evento.
      stream_options: { include_usage: true },
      // `max_tokens` está deprecado en el dialecto y es incompatible con los modelos de
      // razonamiento, que son justamente los que usamos.
      max_completion_tokens: input.maxTokens,
      reasoning_effort: reasoningEffort(input),
      messages: [
        { role: 'system', content: input.prompts.system },
        {
          role: 'user',
          content: [
            // La imagen viaja como data URI, no como campo aparte: es la única forma que el
            // dialecto acepta para bytes locales.
            {
              type: 'image_url',
              image_url: { url: `data:${input.mediaType};base64,${input.imageBase64}` },
            },
            { type: 'text', text: input.prompts.user },
          ],
        },
      ],
      // `strict: true` hace decodificación restringida: el modelo no *puede* devolver otra forma.
      // Es más fuerte que `{ type: 'json_object' }`, que sólo garantiza JSON sintáctico y deja los
      // nombres de campo a criterio del modelo — con eso, `parseProductoLeido` rebota una respuesta
      // correcta por haberla llamado "producto" en vez de "tipo".
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'lectura_de_producto', schema: input.schema, strict: true },
      },
    },
  };
}

/**
 * El dialecto no tiene tipos de evento: todos los frames son `chat.completion.chunk` y lo que
 * cambia es qué campos vienen llenos. Por eso se lee por presencia de campo y no por un
 * discriminador, al revés que Gemini y Anthropic.
 */
function readEvent(payload: Record<string, unknown>): ProviderEvent | null {
  const error = payload.error as { message?: string; code?: string; type?: string } | undefined;
  if (error) {
    const message = error.message ?? 'error de stream';
    // El dialecto marca la cuota con `code: 'rate_limit_exceeded'`. Se normaliza al
    // `quota_exceeded` que el motor ya entiende, y se aprovecha el "try again in 1.5s" que ambos
    // proveedores meten en el propio texto, en vez de adivinar un backoff.
    const esCuota = error.code === 'rate_limit_exceeded' || error.type === 'rate_limit_exceeded';
    const match = /try again in ([\d.]+)s/i.exec(message);
    return {
      kind: 'error',
      message,
      code: esCuota ? 'quota_exceeded' : error.code,
      retryAfterSeconds: match ? Math.ceil(Number(match[1])) : undefined,
    };
  }

  const usage = readUsage(payload);
  const choice = (payload.choices as { delta?: { content?: unknown }; finish_reason?: unknown }[])?.[0];

  // El frame final de `include_usage` viene con `choices: []` y sólo el uso: es el cierre.
  if (!choice) return usage ? { kind: 'stop', usage } : null;

  if (typeof choice.finish_reason === 'string') {
    return { kind: 'stop', stopReason: choice.finish_reason, usage };
  }
  if (typeof choice.delta?.content === 'string' && choice.delta.content.length > 0) {
    return { kind: 'text', text: choice.delta.content };
  }
  // El primer delta trae sólo `role: 'assistant'`: es el arranque del texto visible.
  if (choice.delta) return { kind: 'text-start' };
  return null;
}

function readUsage(payload: Record<string, unknown>): TokenUsage | undefined {
  const usage = payload.usage as Record<string, number | undefined> | null | undefined;
  if (!usage) return undefined;
  const input = usage.prompt_tokens;
  const output = usage.completion_tokens;
  if (input == null && output == null) return undefined;
  return { input_tokens: input ?? 0, output_tokens: output ?? 0 };
}

/** Arma un proveedor del dialecto apuntando a una base URL concreta. */
export function crearProveedorOpenAiCompatible(opciones: {
  id: VisionProviderId;
  label: string;
  url: string;
}): VisionProvider {
  return {
    id: opciones.id,
    label: opciones.label,
    buildRequest: (input) => buildRequest(opciones.url, input),
    readEvent,
  };
}
