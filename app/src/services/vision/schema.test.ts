import { parseBusReading } from './schema';

describe('parseBusReading', () => {
  it('parsea una lectura válida', () => {
    const reading = parseBusReading(
      '{"line":"116","destination":"Plaza Independencia","confidence":0.92,"raw_text":["116","PLAZA INDEPENDENCIA"]}',
    );

    expect(reading).toEqual({
      line: '116',
      destination: 'Plaza Independencia',
      confidence: 0.92,
      raw_text: ['116', 'PLAZA INDEPENDENCIA'],
    });
  });

  it('acepta línea y destino nulos cuando el cartel no se pudo leer', () => {
    const reading = parseBusReading(
      '{"line":null,"destination":null,"confidence":0,"raw_text":[]}',
    );

    expect(reading?.line).toBeNull();
    expect(reading?.raw_text).toEqual([]);
  });

  it('tolera que el modelo envuelva el JSON en un bloque de código', () => {
    const reading = parseBusReading(
      '```json\n{"line":"174","destination":"Plaza Americana","confidence":0.8,"raw_text":["174"]}\n```',
    );

    expect(reading?.line).toBe('174');
  });

  it('devuelve null ante JSON truncado (por ejemplo stop_reason max_tokens)', () => {
    expect(parseBusReading('{"line":"116","destination":"Plaza Inde')).toBeNull();
  });

  it('devuelve null si falta un campo requerido', () => {
    expect(parseBusReading('{"line":"116","confidence":0.9,"raw_text":[]}')).toBeNull();
  });

  it('devuelve null si raw_text no es un arreglo de strings', () => {
    expect(
      parseBusReading('{"line":"116","destination":"X","confidence":0.9,"raw_text":[116]}'),
    ).toBeNull();
  });

  it('devuelve null ante texto vacío', () => {
    expect(parseBusReading('   ')).toBeNull();
  });
});
