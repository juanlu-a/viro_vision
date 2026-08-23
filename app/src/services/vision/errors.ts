/**
 * Errores tipados de la capa de visión en la nube, compartidos por el benchmark (instrumentación)
 * y por el camino de producto de supermercado (ADR 0006). Viven aparte para que ese camino no
 * tenga que importar el módulo de benchmark, que la regla de frontera reserva a desarrollo.
 *
 * La UI decide qué mensaje mostrar por el TIPO del error, nunca parseando strings.
 */

/** Se lanza cuando el proveedor del modelo elegido no tiene clave (ver app/.env.example). */
export class VisionNotConfiguredError extends Error {
  constructor() {
    super('VISION_NOT_CONFIGURED');
    this.name = 'VisionNotConfiguredError';
  }
}

/** Se lanza ante una respuesta HTTP no-2xx. `body` trae el detalle de la API. */
export class VisionHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`VISION_HTTP_${status}`);
    this.name = 'VisionHttpError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Cuota agotada. Se distingue del resto porque **es esperable y se resuelve esperando**: el tier
 * gratuito de Gemini admite 20 requests por minuto y una medición completa son 7, así que dos
 * mediciones seguidas lo alcanzan. El proveedor informa cuánto esperar y ese dato se conserva.
 */
export class VisionQuotaError extends Error {
  readonly retryAfterSeconds: number;

  constructor(detail: string, retryAfterSeconds: number) {
    super(detail);
    this.name = 'VisionQuotaError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Se lanza ante un evento de error a mitad de stream (llega con HTTP 200). */
export class VisionStreamError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('VISION_STREAM_ERROR');
    this.name = 'VisionStreamError';
    this.detail = detail;
  }
}
