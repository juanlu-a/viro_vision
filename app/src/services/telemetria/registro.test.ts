/**
 * Existe por dos cosas que, si se rompen, no dan ningún error visible.
 *
 * La primera es el **contrato de la función**: un evento sin `tipo` o sin `momento` se descarta del
 * lado del servidor y la respuesta sigue siendo 200 con `{guardados: 0}`. O sea que una app que
 * arma mal el cuerpo se ve exactamente igual que una que anda, y el defecto recién aparece cuando
 * alguien va a consultar la tabla después de una falla y no encuentra nada.
 *
 * La segunda es la **regla de frontera de ADR 0001**: registrar no puede lanzar ni hacer esperar a
 * nadie. Un `fetch` que rechaza en el camino de una lectura tumbaría la lectura, que es justo lo
 * contrario de para qué existe la telemetría.
 *
 * El reloj, el `fetch` y el temporizador se inyectan: un test que dependiera del reloj real tardaría
 * quince segundos por aserción, y uno que leyera `process.env` mediría dónde corre y no qué hace
 * (la lección del fallo de TestFlight del 2026-09-02).
 */
import { MAX_EN_COLA } from './cola';
import { generarId, obtenerTelefono, TELEFONO_KEY } from './identidad';
import { iniciarTelemetria, registrar, reiniciarTelemetriaParaTests, subir } from './registro';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- la factory de jest.mock corre antes que los imports; require es la forma documentada del mock oficial.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const URL = 'https://ejemplo.test/functions/v1/telemetria';

function fetchQueRegistra() {
  const cuerpos: any[] = [];
  const impl = jest.fn(async (_url: string, init?: RequestInit) => {
    cuerpos.push(JSON.parse(String(init?.body)));
    return { ok: true, status: 200 } as Response;
  });
  return { impl: impl as unknown as typeof fetch, cuerpos };
}

/** El temporizador nunca dispara solo: cada test decide cuándo, o el reloj real mandaría. */
const programar = (() => 0 as unknown as ReturnType<typeof setTimeout>) as any;
const cancelar = (() => {}) as any;

function arrancar(fetchImpl: typeof fetch, momento = '2026-09-09T12:00:00.000Z') {
  return iniciarTelemetria({
    url: URL,
    fetchImpl,
    ahora: () => new Date(momento),
    programar,
    cancelar,
  });
}

afterEach(() => reiniciarTelemetriaParaTests());

describe('registrar', () => {
  it('arma cada evento con tipo y momento: sin eso la función lo descarta y contesta 200 igual', async () => {
    const { impl, cuerpos } = fetchQueRegistra();
    const parar = arrancar(impl);
    registrar('lectura.ok', { ms: 1234.7, detalle: { modo: 'supermercado' } });
    await subir();
    parar();

    expect(cuerpos).toHaveLength(1);
    const [lote] = cuerpos;
    expect(lote.telefono).toEqual(expect.any(String));
    expect(lote.sesion).toEqual(expect.any(String));
    expect(lote.eventos[0]).toEqual({
      tipo: 'lectura.ok',
      momento: '2026-09-09T12:00:00.000Z',
      ms: 1234.7,
      detalle: { modo: 'supermercado' },
    });
  });

  it('sin URL configurada no encola nada: la telemetría queda apagada entera', async () => {
    const { impl, cuerpos } = fetchQueRegistra();
    const parar = iniciarTelemetria({ url: '', fetchImpl: impl, programar, cancelar });
    registrar('app.inicio');
    await subir();
    parar();
    expect(cuerpos).toHaveLength(0);
  });

  it('un `ms` que no es número finito no viaja: la función lo guardaría como null y ensuciaría la columna', async () => {
    const { impl, cuerpos } = fetchQueRegistra();
    const parar = arrancar(impl);
    registrar('foto.ok', { ms: NaN });
    await subir();
    parar();
    expect(cuerpos[0].eventos[0]).not.toHaveProperty('ms');
  });

  it('no lanza aunque el detalle sea imposible de serializar (ADR 0001: no puede tumbar una lectura)', () => {
    const { impl } = fetchQueRegistra();
    const parar = arrancar(impl);
    const ciclico: Record<string, unknown> = {};
    ciclico.yo = ciclico;
    expect(() => registrar('lectura.fallo', { detalle: ciclico })).not.toThrow();
    parar();
  });
});

describe('subir', () => {
  it('no lanza cuando no hay internet — el caso NORMAL unido al AP de la placa — y conserva el lote', async () => {
    const rechaza = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const parar = arrancar(rechaza);
    registrar('ble.conectado');
    await expect(subir()).resolves.toBeUndefined();

    // El lote volvió a la cola: se sube cuando haya red, no se pierde.
    const { impl, cuerpos } = fetchQueRegistra();
    parar();
    const parar2 = arrancar(impl);
    await subir();
    parar2();
    expect(cuerpos[0].eventos.map((e: any) => e.tipo)).toEqual(['ble.conectado']);
  });

  it('un 500 del servidor también conserva el lote', async () => {
    const quinientos = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const parar = arrancar(quinientos);
    registrar('app.error');
    await subir();
    parar();

    const { impl, cuerpos } = fetchQueRegistra();
    const parar2 = arrancar(impl);
    await subir();
    parar2();
    expect(cuerpos[0].eventos).toHaveLength(1);
  });

  it('tras desbordar la cola sin red, el lote que sí sube declara cuántos eventos se perdieron', async () => {
    const rechaza = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const parar = arrancar(rechaza);
    // Más de MAX_EN_COLA con el envío caído: es lo que pasa en una sesión larga unida al AP.
    for (let i = 0; i < MAX_EN_COLA + 60; i++) registrar('placa.estado', { detalle: { i } });
    // Deja resolver los rechazos que dispararon los envíos por umbral.
    await new Promise((r) => setImmediate(r));
    parar();

    const { impl, cuerpos } = fetchQueRegistra();
    const parar2 = arrancar(impl);
    await subir();
    parar2();

    const aviso = cuerpos[0].eventos.find((e: any) => e.tipo === 'app.error');
    expect(aviso?.detalle?.eventosPerdidos).toBeGreaterThan(0);
  });
});

describe('identidad', () => {
  it('el id del teléfono se guarda y se reusa: sin eso cada arranque parece otro aparato', async () => {
    const memoria = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => memoria.get(k) ?? null,
      setItem: async (k: string, v: string) => void memoria.set(k, v),
    };
    const primero = await obtenerTelefono(storage as any, () => 0.5);
    const segundo = await obtenerTelefono(storage as any, () => 0.9);
    expect(segundo).toBe(primero);
    expect(memoria.get(TELEFONO_KEY)).toBe(primero);
  });

  it('si AsyncStorage falla devuelve un id efímero en vez de romper', async () => {
    const roto = {
      getItem: async () => {
        throw new Error('disco lleno');
      },
      setItem: async () => {},
    };
    await expect(obtenerTelefono(roto as any)).resolves.toContain('tel-efimero');
  });

  it('el id no lleva nada del sistema: es azar con prefijo', () => {
    expect(generarId('tel', () => 0)).toBe('tel-0000000000000000');
  });
});
