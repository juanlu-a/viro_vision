/**
 * Existe porque esta cola decide **qué diagnóstico se pierde** cuando el envío falla, y el envío va
 * a fallar seguido: mientras el teléfono está unido al AP de la placa hay WiFi pero no internet
 * (ADR 0003). Si el descarte tirara lo nuevo en vez de lo viejo, la tabla tendría siempre el
 * arranque de la app y nunca el momento de la falla — que es lo único que se va a consultar. Y si
 * los descartes no se contaran, un hueco se leería como "eso no pasó".
 */
import { ColaDeEventos } from './cola';
import type { EventoTelemetria, TipoEvento } from './tipos';

function evento(n: number, tipo: TipoEvento = 'lectura.ok'): EventoTelemetria {
  return { tipo, momento: new Date(n).toISOString(), detalle: { n } };
}

const numeros = (lote: EventoTelemetria[]) => lote.map((e) => (e.detalle as { n: number }).n);

describe('ColaDeEventos', () => {
  it('entrega los eventos más viejos primero: la tabla se lee en orden', () => {
    const cola = new ColaDeEventos();
    for (const n of [1, 2, 3]) cola.encolar(evento(n));
    expect(numeros(cola.tomarLote())).toEqual([1, 2, 3]);
    expect(cola.largo).toBe(0);
  });

  it('pasado el tope descarta lo VIEJO y conserva lo nuevo', () => {
    const cola = new ColaDeEventos(3);
    for (const n of [1, 2, 3, 4, 5]) cola.encolar(evento(n));
    expect(numeros(cola.tomarLote())).toEqual([3, 4, 5]);
  });

  it('cuenta lo descartado, para que el hueco no se lea como "no pasó"', () => {
    const cola = new ColaDeEventos(2);
    for (const n of [1, 2, 3, 4]) cola.encolar(evento(n));
    expect(cola.perdidos).toBe(2);
    cola.olvidarPerdidos();
    expect(cola.perdidos).toBe(0);
  });

  it('un lote que no se pudo subir vuelve adelante, sin alterar el orden', () => {
    const cola = new ColaDeEventos();
    for (const n of [1, 2]) cola.encolar(evento(n));
    const lote = cola.tomarLote();
    cola.encolar(evento(3));
    cola.devolver(lote);
    expect(numeros(cola.tomarLote())).toEqual([1, 2, 3]);
  });

  it('devolver un lote que ya no entra pierde el lote, no lo que está pasando ahora', () => {
    const cola = new ColaDeEventos(3);
    for (const n of [1, 2]) cola.encolar(evento(n));
    const lote = cola.tomarLote();
    for (const n of [3, 4, 5]) cola.encolar(evento(n));
    cola.devolver(lote);
    expect(numeros(cola.tomarLote())).toEqual([3, 4, 5]);
    expect(cola.perdidos).toBe(2);
  });

  it('corta el lote en el tope de la función: un lote más grande lo recorta el servidor', () => {
    const cola = new ColaDeEventos(500);
    for (let n = 0; n < 250; n++) cola.encolar(evento(n));
    expect(cola.tomarLote(100)).toHaveLength(100);
    expect(cola.largo).toBe(150);
  });
});
