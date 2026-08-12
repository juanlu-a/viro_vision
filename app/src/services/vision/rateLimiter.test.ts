/**
 * El reloj y la espera se inyectan en todos los casos: un test que dependa de `Date.now()` y de
 * `setTimeout` reales tendría que esperar un minuto de verdad para probar la ventana móvil.
 */
import { acquireSlot, remainingSlots, resetRateLimiter } from './rateLimiter';

afterEach(resetRateLimiter);

/** Reloj falso: avanza sólo cuando se lo pide el test. */
function relojFalso(inicio = 1_000_000) {
  let t = inicio;
  return {
    now: () => t,
    avanzar: (ms: number) => {
      t += ms;
    },
  };
}

describe('acquireSlot', () => {
  it('deja pasar sin esperar mientras haya lugar en la ventana', async () => {
    const reloj = relojFalso();
    let esperas = 0;

    for (let i = 0; i < 3; i += 1) {
      await acquireSlot('modelo', { now: reloj.now, maxPerWindow: 3, onWait: () => (esperas += 1) });
    }

    expect(esperas).toBe(0);
    expect(remainingSlots('modelo', reloj.now(), 3)).toBe(0);
  });

  it('cada modelo lleva su propia cuenta', async () => {
    const reloj = relojFalso();
    await acquireSlot('flash', { now: reloj.now, maxPerWindow: 1 });

    // Si las cuentas se mezclaran, acá habría que esperar en vez de pasar de largo.
    let espero = false;
    await acquireSlot('flash-lite', {
      now: reloj.now,
      maxPerWindow: 1,
      onWait: () => (espero = true),
    });

    expect(espero).toBe(false);
  });

  it('libera el cupo cuando el envío sale de la ventana', async () => {
    const reloj = relojFalso();
    await acquireSlot('modelo', { now: reloj.now, maxPerWindow: 1 });
    expect(remainingSlots('modelo', reloj.now(), 1)).toBe(0);

    reloj.avanzar(60_001);

    let espero = false;
    await acquireSlot('modelo', {
      now: reloj.now,
      maxPerWindow: 1,
      onWait: () => (espero = true),
    });

    expect(espero).toBe(false);
  });

  it('avisa cuánto hay que esperar y recién manda cuando se libera el cupo', async () => {
    const reloj = relojFalso();
    await acquireSlot('modelo', { now: reloj.now, maxPerWindow: 1 });

    reloj.avanzar(20_000);

    const avisos: number[] = [];
    await acquireSlot('modelo', {
      now: reloj.now,
      maxPerWindow: 1,
      onWait: (ms) => avisos.push(ms),
      // Al "dormir" adelantamos el reloj falso en vez de esperar de verdad.
      sleep: async (ms) => reloj.avanzar(ms),
    });

    // Del minuto de la ventana ya pasaron 20 s: quedan ~40 s más el margen del limitador.
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toBeGreaterThan(39_000);
    expect(avisos[0]).toBeLessThan(41_000);
  });

  it('corta la espera si se cancela la corrida', async () => {
    const reloj = relojFalso();
    const controller = new AbortController();
    await acquireSlot('modelo', { now: reloj.now, maxPerWindow: 1 });

    // Sin el chequeo de `aborted` al principio de cada vuelta, esto giraría para siempre: el
    // reloj falso no avanza solo y nadie va a liberar el cupo.
    await acquireSlot('modelo', {
      now: reloj.now,
      maxPerWindow: 1,
      signal: controller.signal,
      onWait: () => controller.abort(),
      sleep: async () => {},
    });
  });
});

describe('remainingSlots', () => {
  it('arranca con la ventana entera disponible', () => {
    expect(remainingSlots('modelo', 1_000_000)).toBe(17);
  });
});
