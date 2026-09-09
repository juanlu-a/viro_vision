/**
 * La dirección de la placa en la red local y el error tipado de hablarle por HTTP: el camino de la
 * foto que decidió el ADR 0003 (WiFi, 46 ms contra 4,5 s por BLE, medido el 2026-09-05).
 *
 * REGLA DE FRONTERA (ADR 0003): esto habla con la placa en la red local, nunca con internet. El
 * teléfono tiene que conservar su internet (datos o WiFi) mientras tanto; si la placa está en la
 * misma red que el teléfono no hay conflicto, y si la placa fuera el punto de acceso el sistema
 * tiene que enrutar internet por datos (spike pendiente). Sin TLS a propósito: WPA2 ya cifra el
 * aire y los datos no son sensibles; por eso `app.json` permite HTTP plano sólo hacia red local.
 *
 * Acá vivía además `medirDescargaHttp`, que bajaba `/medir/<bytes>` y cronometraba. Se fue con los
 * botones de medición: el ADR 0003 ya está decidido y la placa nunca más va a servir relleno.
 */

export class HttpDescargaError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = 'HttpDescargaError';
  }
}

export interface DireccionPlaca {
  ip: string;
  puerto: number;
}

export function urlDeLaPlaca({ ip, puerto }: DireccionPlaca, ruta: string): string {
  return `http://${ip}:${puerto}${ruta}`;
}
