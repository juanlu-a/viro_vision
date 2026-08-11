import { parseBusReading } from './schema';

describe('parseBusReading', () => {
  it('parsea una lectura válida', () => {
    const reading = parseBusReading('{"numero":"116","nombre":"Plaza Independencia"}');

    expect(reading).toEqual({ numero: '116', nombre: 'Plaza Independencia' });
  });

  it('acepta ambos campos nulos cuando el cartel no se pudo leer', () => {
    const reading = parseBusReading('{"numero":null,"nombre":null}');

    expect(reading).toEqual({ numero: null, nombre: null });
  });

  it('acepta un campo nulo y el otro leído', () => {
    expect(parseBusReading('{"numero":"174","nombre":null}')?.numero).toBe('174');
  });

  it('tolera que el modelo envuelva el JSON en un bloque de código', () => {
    const reading = parseBusReading('```json\n{"numero":"174","nombre":"Plaza Americana"}\n```');

    expect(reading?.numero).toBe('174');
  });

  it('devuelve null ante JSON truncado (por ejemplo stop_reason max_tokens)', () => {
    expect(parseBusReading('{"numero":"116","nombre":"Plaza Inde')).toBeNull();
  });

  it('devuelve null si falta un campo requerido', () => {
    expect(parseBusReading('{"numero":"116"}')).toBeNull();
  });

  it('devuelve null si un campo no es string ni null', () => {
    expect(parseBusReading('{"numero":116,"nombre":"X"}')).toBeNull();
  });

  it('devuelve null ante texto vacío', () => {
    expect(parseBusReading('   ')).toBeNull();
  });
});
