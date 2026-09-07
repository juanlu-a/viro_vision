/**
 * Cola de eventos de telemetría: lo puro. Junta eventos, los manda en lotes, y si la red falla los
 * conserva hasta un tope. Sin React, sin fetch real: todo inyectable, para testear la política de
 * lotes y de descarte sin red.
 *
 * REGLA (ADR 0001): esto nunca está en el camino del reconocimiento ni del anuncio. Registrar es
 * best-effort: una cola llena descarta lo más viejo, un servidor caído se reintenta después, y
 * ningún error sale de acá.
 */

export interface EventoTelemetria {
  tipo: string;
  /** ISO 8601, hora del teléfono. */
  momento: string;
  ms?: number | null;
  detalle?: Record<string, unknown>;
}

export interface LoteTelemetria {
  telefono: string;
  sesion: string;
  app?: string;
  eventos: EventoTelemetria[];
}

export interface OpcionesCola {
  /** Cuántos eventos por envío como máximo (la función acepta hasta 100). */
  tamanoLote?: number;
  /** Tope de eventos guardados sin red; por encima se descarta lo más viejo. */
  maximoEnCola?: number;
  enviar: (lote: LoteTelemetria) => Promise<boolean>;
  now?: () => number;
}

export class ColaTelemetria {
  private pendientes: EventoTelemetria[] = [];
  private enviando = false;
  private readonly tamanoLote: number;
  private readonly maximoEnCola: number;
  private readonly enviar: OpcionesCola['enviar'];
  private readonly now: () => number;
  descartados = 0;

  constructor(
    private readonly identidad: { telefono: string; sesion: string; app?: string },
    opciones: OpcionesCola
  ) {
    this.tamanoLote = opciones.tamanoLote ?? 50;
    this.maximoEnCola = opciones.maximoEnCola ?? 500;
    this.enviar = opciones.enviar;
    this.now = opciones.now ?? Date.now;
  }

  get cantidad(): number {
    return this.pendientes.length;
  }

  registrar(tipo: string, detalle?: Record<string, unknown>, ms?: number | null): void {
    this.pendientes.push({ tipo, momento: new Date(this.now()).toISOString(), ms: ms ?? null, detalle });
    if (this.pendientes.length > this.maximoEnCola) {
      this.pendientes.splice(0, this.pendientes.length - this.maximoEnCola);
      this.descartados += 1;
    }
  }

  /** Manda lo pendiente en lotes. Si un envío falla, lo que no salió queda para la próxima. */
  async vaciar(): Promise<number> {
    if (this.enviando) return 0;
    this.enviando = true;
    let enviados = 0;
    try {
      while (this.pendientes.length > 0) {
        const lote = this.pendientes.slice(0, this.tamanoLote);
        let ok = false;
        try {
          ok = await this.enviar({ ...this.identidad, eventos: lote });
        } catch {
          ok = false;
        }
        if (!ok) break;
        this.pendientes.splice(0, lote.length);
        enviados += lote.length;
      }
    } finally {
      this.enviando = false;
    }
    return enviados;
  }
}

/** La función de telemetría vive junto al proxy de visión: mismo proyecto, otra ruta. */
export function urlDeTelemetria(proxyUrl: string | undefined | null): string | null {
  if (!proxyUrl) return null;
  const sinBarra = proxyUrl.replace(/\/+$/, '');
  return sinBarra.endsWith('/vision') ? `${sinBarra.slice(0, -'/vision'.length)}/telemetria` : null;
}
