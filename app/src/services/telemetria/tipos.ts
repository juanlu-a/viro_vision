/**
 * El contrato con la función `telemetria` (ADR 0008, misma familia que el proxy de visión).
 *
 * **Espejo de `supabase/functions/telemetria/index.ts`**, como `features/device/gatt.ts` lo es del
 * perfil de la placa: si cambia el contrato allá, cambia acá en el mismo PR.
 *
 * Dos reglas de la función que no se ven desde acá y muerden en silencio:
 *   - un evento **sin `tipo` o sin `momento` se descarta sin error**: la respuesta dice
 *     `{guardados: 0}` con status 200, así que un campo mal puesto no se nota nunca. Por eso el tipo
 *     los hace obligatorios y `registrar()` pone el `momento` él mismo;
 *   - `detalle` se serializa y si pasa de 8 KB se reemplaza entero por `{recortado: true}` — se
 *     pierde TODO el detalle, no la parte de más. Nada de meter una imagen ni un texto largo acá.
 */

/**
 * Los tipos de evento, cerrados a propósito.
 *
 * Es una tabla que después hay que consultar: con strings libres, un `lectura.fallo` y un
 * `lectura_fallo` conviven felices y ninguna consulta los ve a los dos. Agregar un tipo es agregar
 * una línea acá.
 */
export type TipoEvento =
  // Ciclo de vida de la app
  | 'app.inicio'
  | 'app.fondo'
  | 'app.error'
  // Enlace BLE (plano de control, ADR 0003)
  | 'ble.buscando'
  | 'ble.conectado'
  | 'ble.fallo'
  | 'ble.perdido'
  | 'ble.reintento'
  | 'ble.desconectado'
  // Red WiFi con la placa (por donde viaja la foto)
  | 'wifi.uniendose'
  | 'wifi.listo'
  | 'wifi.fallo'
  // Lo que informa la placa de sí misma
  | 'placa.estado'
  | 'placa.aviso'
  | 'placa.modo'
  | 'placa.modoFallo'
  // Modos de operación (ADR 0007)
  | 'modo.cambio'
  // Una lectura, de punta a punta
  | 'lectura.inicio'
  | 'lectura.ok'
  | 'lectura.fallo'
  | 'foto.ok'
  | 'foto.fallo'
  | 'ocr.carga'
  | 'nube.espera'
  | 'audio.envio';

export interface EventoTelemetria {
  tipo: TipoEvento;
  /** ISO 8601. Obligatorio: sin esto la función descarta el evento y contesta 200 igual. */
  momento: string;
  /** Duración de lo que el evento mide, cuando mide algo. La función lo redondea a entero. */
  ms?: number;
  /** Contexto del evento. Serializado tiene que quedar bajo 8 KB (ver arriba). */
  detalle?: Record<string, unknown>;
}

/** El cuerpo que espera la función. `app` identifica la versión, para no comparar peras con manzanas. */
export interface LoteTelemetria {
  telefono: string;
  sesion: string;
  app: string;
  eventos: EventoTelemetria[];
}
