/**
 * Errores tipados de la capa de visión en la nube (modo supermercado, ADR 0006).
 *
 * La UI decide qué mensaje mostrar y qué anunciar por voz por el TIPO del error, nunca parseando
 * strings — y cuando un error trae un dato accionable (cuánto esperar, qué falló), va como campo.
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
 * gratuito de Gemini admite 20 requests por minuto por modelo. El proveedor informa cuánto esperar
 * y ese dato se conserva para decírselo al usuario.
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

/**
 * La red falló antes de que el proveedor respondiera (sin señal, DNS, TLS). `expo/fetch` rechaza
 * con un `TypeError` genérico; envolverlo permite que la UI anuncie "sin conexión" en vez de un
 * mensaje técnico — y que el modo supermercado degrade a un estado rotulado (ADR 0001).
 */
export class VisionNetworkError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('VISION_NETWORK_ERROR');
    this.name = 'VisionNetworkError';
    this.detail = detail;
  }
}
