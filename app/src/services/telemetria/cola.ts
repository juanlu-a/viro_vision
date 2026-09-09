/**
 * La cola de eventos pendientes de subir. Módulo PURO —sin red, sin React, sin reloj— para poder
 * testear la política de descarte, que es la parte que decide qué se pierde cuando algo va mal.
 *
 * Y algo va a ir mal: la telemetría se sube desde un teléfono que está unido al WiFi de la placa,
 * una red **sin internet** (ADR 0003). O sea que durante una sesión de uso real el envío falla
 * seguido y la cola crece. Por eso hay tope y hay una regla explícita de qué se tira.
 *
 * **Se tira lo más viejo.** Cuando el diagnóstico importa —alguien reporta que no le leyó el
 * cartel— lo que hay que mirar son los últimos segundos, no el arranque de la app. Guardar lo viejo
 * y tirar lo nuevo dejaría justo el hueco donde está la falla.
 */
import type { EventoTelemetria } from './tipos';

/** Tope de la función: un lote más grande se recorta del lado del servidor y se pierde la cola. */
export const MAX_POR_LOTE = 100;

/**
 * Cuántos eventos se guardan sin poder subirlos. 500 son unos minutos de uso intenso y unos pocos
 * cientos de KB en memoria; más que eso es acumular para nadie, porque lo viejo ya no se consulta.
 */
export const MAX_EN_COLA = 500;

export class ColaDeEventos {
  private eventos: EventoTelemetria[] = [];
  private descartados = 0;

  constructor(private readonly max: number = MAX_EN_COLA) {}

  get largo(): number {
    return this.eventos.length;
  }

  /**
   * Cuántos eventos se tiraron por falta de lugar desde el último lote enviado. Viaja en el
   * siguiente lote: un agujero silencioso en la telemetría es peor que no tenerla, porque lleva a
   * concluir que algo "no pasó" cuando en realidad no se pudo contar.
   */
  get perdidos(): number {
    return this.descartados;
  }

  encolar(evento: EventoTelemetria): void {
    this.eventos.push(evento);
    if (this.eventos.length > this.max) {
      this.descartados += this.eventos.length - this.max;
      this.eventos = this.eventos.slice(-this.max);
    }
  }

  /** Saca hasta `MAX_POR_LOTE` eventos, los más viejos primero: la tabla se lee en orden. */
  tomarLote(max: number = MAX_POR_LOTE): EventoTelemetria[] {
    return this.eventos.splice(0, max);
  }

  /**
   * Devuelve a la cola un lote que no se pudo subir, **adelante**, para no alterar el orden.
   *
   * Si mientras tanto entraron eventos nuevos y ya no entran todos, el descarte lo hace `encolar`
   * como siempre: se pierde lo más viejo, que acá es justo el lote devuelto. Es deliberado — un
   * lote que ya falló compite en igualdad con lo que está pasando ahora, y lo que está pasando
   * ahora vale más.
   */
  devolver(lote: EventoTelemetria[]): void {
    this.eventos = [...lote, ...this.eventos];
    if (this.eventos.length > this.max) {
      this.descartados += this.eventos.length - this.max;
      this.eventos = this.eventos.slice(-this.max);
    }
  }

  /** Se llama cuando un lote se subió bien: el contador viajó con él y ya no hay que repetirlo. */
  olvidarPerdidos(): void {
    this.descartados = 0;
  }
}
