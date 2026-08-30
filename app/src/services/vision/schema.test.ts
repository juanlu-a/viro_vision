/**
 * Existe porque la voz depende de esto: si el parser rechaza un JSON válido, el usuario escucha
 * el texto crudo en vez del producto; si acepta basura, escucha basura. Los casos vienen de
 * respuestas reales: bloques ```json, truncamiento por max_tokens, texto vacío.
 */
import { parseJsonRecord } from './schema';

describe('parseJsonRecord', () => {
  it('parsea un objeto JSON plano', () => {
    expect(parseJsonRecord('{"producto":"Yerba","detalle":null}')).toEqual({ producto: 'Yerba', detalle: null });
  });

  it('tolera que el modelo envuelva el JSON en un bloque de código', () => {
    expect(parseJsonRecord('```json\n{"producto":"Arroz"}\n```')).toEqual({ producto: 'Arroz' });
  });

  it('devuelve null ante JSON truncado (por ejemplo stop_reason max_tokens)', () => {
    expect(parseJsonRecord('{"producto":"Arro')).toBeNull();
  });

  it('devuelve null si no es un objeto (array, número, texto vacío)', () => {
    expect(parseJsonRecord('[1,2]')).toBeNull();
    expect(parseJsonRecord('42')).toBeNull();
    expect(parseJsonRecord('   ')).toBeNull();
  });
});
