/**
 * Existe porque la telemetría es best-effort por diseño (ADR 0001): si un fallo de red bloqueara la
 * cola, o una cola sin tope creciera sin fin en la calle sin señal, el registro terminaría afectando
 * lo que sí importa. Y la URL se deriva del proxy: derivarla mal manda los eventos al vacío.
 */
import { ColaTelemetria, urlDeTelemetria } from './cola';

const identidad = { telefono: 't1', sesion: 's1', app: '1.0 (42)' };

describe('ColaTelemetria', () => {
  it('manda en lotes del tamaño configurado y vacía la cola', async () => {
    const lotes: number[] = [];
    const cola = new ColaTelemetria(identidad, { tamanoLote: 2, enviar: async (l) => (lotes.push(l.eventos.length), true), now: () => 0 });
    for (let i = 0; i < 5; i++) cola.registrar('x');
    expect(await cola.vaciar()).toBe(5);
    expect(lotes).toEqual([2, 2, 1]);
    expect(cola.cantidad).toBe(0);
  });

  it('si el envío falla conserva lo pendiente para la próxima', async () => {
    let falla = true;
    const cola = new ColaTelemetria(identidad, { enviar: async () => !falla, now: () => 0 });
    cola.registrar('a');
    cola.registrar('b');
    expect(await cola.vaciar()).toBe(0);
    expect(cola.cantidad).toBe(2);
    falla = false;
    expect(await cola.vaciar()).toBe(2);
  });

  it('un envío que lanza no rompe nada: cuenta como fallo', async () => {
    const cola = new ColaTelemetria(identidad, { enviar: async () => { throw new Error('sin red'); }, now: () => 0 });
    cola.registrar('a');
    await expect(cola.vaciar()).resolves.toBe(0);
    expect(cola.cantidad).toBe(1);
  });

  it('sin red la cola tiene tope y descarta lo más viejo', () => {
    const cola = new ColaTelemetria(identidad, { maximoEnCola: 3, enviar: async () => false, now: () => 0 });
    for (const t of ['1', '2', '3', '4', '5']) cola.registrar(t);
    expect(cola.cantidad).toBe(3);
    expect(cola.descartados).toBe(2);
  });

  it('el lote lleva la identidad y el momento en ISO', async () => {
    let recibido: unknown;
    const cola = new ColaTelemetria(identidad, { enviar: async (l) => ((recibido = l), true), now: () => Date.UTC(2026, 8, 7, 12, 0, 0) });
    cola.registrar('lectura', { modelo: 'x' }, 1670);
    await cola.vaciar();
    expect(recibido).toEqual({
      ...identidad,
      eventos: [{ tipo: 'lectura', momento: '2026-09-07T12:00:00.000Z', ms: 1670, detalle: { modelo: 'x' } }],
    });
  });
});

describe('urlDeTelemetria', () => {
  it('cambia /vision por /telemetria en la URL del proxy', () => {
    expect(urlDeTelemetria('https://x.supabase.co/functions/v1/vision')).toBe('https://x.supabase.co/functions/v1/telemetria');
    expect(urlDeTelemetria('https://x.supabase.co/functions/v1/vision/')).toBe('https://x.supabase.co/functions/v1/telemetria');
  });
  it('sin proxy, o con una URL que no es la del proxy, no hay telemetría', () => {
    expect(urlDeTelemetria(undefined)).toBeNull();
    expect(urlDeTelemetria('https://otro.example/api')).toBeNull();
  });
});
