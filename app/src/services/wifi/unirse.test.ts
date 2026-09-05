/**
 * Existe porque después de unirse al AP el teléfono tarda unos segundos en tener ruta: si
 * `esperarPlaca` fallara al primer intento, el flujo diría "sin conexión con la placa" justo cuando
 * está por funcionar; y si nunca se rindiera, una placa apagada colgaría la app.
 */
import { WifiNoDisponibleError, esperarPlaca, unirseAlWifi } from './unirse';

const direccion = { ip: '10.42.0.1', puerto: 8080 };

describe('esperarPlaca', () => {
  it('reintenta hasta que la placa responde y devuelve true', async () => {
    let llamadas = 0;
    const fetchImpl = (async () => {
      llamadas++;
      if (llamadas < 3) throw new Error('sin ruta');
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const esperas: number[] = [];
    const ok = await esperarPlaca(direccion, { fetchImpl, sleep: async (ms) => void esperas.push(ms), esperaMs: 500 });
    expect(ok).toBe(true);
    expect(llamadas).toBe(3);
    expect(esperas).toEqual([500, 500]);
  });

  it('se rinde después de los intentos configurados', async () => {
    const fetchImpl = (async () => ({ ok: false }) as Response) as unknown as typeof fetch;
    const ok = await esperarPlaca(direccion, { fetchImpl, sleep: async () => {}, intentos: 4 });
    expect(ok).toBe(false);
  });
});

describe('unirseAlWifi', () => {
  it('sin el módulo nativo (Expo Go, web, jest) falla con un error tipado y no con un TypeError', async () => {
    await expect(unirseAlWifi({ ssid: 'ViroVision', clave: 'x' })).rejects.toBeInstanceOf(WifiNoDisponibleError);
  });
});
