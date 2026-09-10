/**
 * Exists because these rows are what the user sees (or walks through with VoiceOver) after a
 * reading: a null field printed as "null", or the kind sitting in the brand row, is a screen that
 * lies.
 */
import { busLineRows, productRows } from './result';

describe('productRows', () => {
  it('one row per field, in kind · brand · detail order', () => {
    expect(productRows({ kind: 'Fideos', brand: 'Adria', detail: 'Tallarines 500 g' })).toEqual([
      { label: 'Producto', value: 'Fideos', empty: false },
      { label: 'Marca', value: 'Adria', empty: false },
      { label: 'Detalle', value: 'Tallarines 500 g', empty: false },
    ]);
  });

  it('a null or blank field is said as "sin leer", never "null"', () => {
    const rows = productRows({ kind: 'Arroz', brand: null, detail: '  ' });
    expect(rows[1]).toEqual({ label: 'Marca', value: 'sin leer', empty: true });
    expect(rows[2].empty).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('null');
  });
});

describe('busLineRows', () => {
  it('line and destination', () => {
    expect(busLineRows({ line: '116', destination: 'Plaza Independencia' })).toEqual([
      { label: 'Línea', value: '116', empty: false },
      { label: 'Destino', value: 'Plaza Independencia', empty: false },
    ]);
  });
});
