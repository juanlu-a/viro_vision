/**
 * Existe porque estas filas son lo que el usuario ve (o recorre con VoiceOver) después de leer: un
 * campo nulo impreso como "null", o el tipo en la fila de la marca, es una pantalla que miente.
 */
import { filasDeLinea, filasDeProducto } from './resultado';

describe('filasDeProducto', () => {
  it('una fila por campo, en el orden tipo · marca · detalle', () => {
    expect(filasDeProducto({ tipo: 'Fideos', marca: 'Adria', detalle: 'Tallarines 500 g' })).toEqual([
      { etiqueta: 'Producto', valor: 'Fideos', vacio: false },
      { etiqueta: 'Marca', valor: 'Adria', vacio: false },
      { etiqueta: 'Detalle', valor: 'Tallarines 500 g', vacio: false },
    ]);
  });

  it('un campo nulo o vacío se dice como "sin leer", nunca "null"', () => {
    const filas = filasDeProducto({ tipo: 'Arroz', marca: null, detalle: '  ' });
    expect(filas[1]).toEqual({ etiqueta: 'Marca', valor: 'sin leer', vacio: true });
    expect(filas[2].vacio).toBe(true);
    expect(JSON.stringify(filas)).not.toContain('null');
  });
});

describe('filasDeLinea', () => {
  it('línea y destino', () => {
    expect(filasDeLinea({ numero: '116', nombre: 'Plaza Independencia' })).toEqual([
      { etiqueta: 'Línea', valor: '116', vacio: false },
      { etiqueta: 'Destino', valor: 'Plaza Independencia', vacio: false },
    ]);
  });
});
