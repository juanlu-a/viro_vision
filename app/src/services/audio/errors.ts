/**
 * Errores tipados de la síntesis de voz a archivo.
 *
 * Mismo criterio que en `services/vision/errors.ts`: quien llama decide qué hacer por el TIPO, no
 * parseando strings, y el dato accionable viaja como campo. Acá el motivo importa porque separa
 * "está apagado a propósito" de "está prendido y se rompió": lo primero no es una falla y no se
 * reporta como tal.
 */

/** La síntesis no está habilitada, o no hay ni clave ni proxy con qué pedirla. */
export class SintesisNoConfiguradaError extends Error {
  readonly motivo: string;

  constructor(motivo: string) {
    super('SINTESIS_NO_CONFIGURADA');
    this.name = 'SintesisNoConfiguradaError';
    this.motivo = motivo;
  }
}

/** El TTS respondió con un status no-2xx. `body` trae el detalle de la API. */
export class SintesisRemotaError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`SINTESIS_HTTP_${status}`);
    this.name = 'SintesisRemotaError';
    this.status = status;
    this.body = body;
  }
}
