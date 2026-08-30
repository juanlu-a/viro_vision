/**
 * Existe porque la salida de estas funciones se ESCUCHA, no se ve: una regresión en el fraseo o
 * en la heurística del número de línea no rompe ninguna pantalla y llega directo al usuario.
 * Los casos vienen de fallos reales del spike (la matrícula como candidato, textos de baja
 * confianza) — ver docs/spike-vision-local.md.
 */
import { adivinarLectura, formatMs, frasearLectura, frasearProducto } from './lectura';
import { strings } from '@/i18n';

describe('adivinarLectura', () => {
  it('elige el número de 2-4 dígitos y el primer texto con letras como nombre', () => {
    const lectura = adivinarLectura([
      { text: '427', score: 0.9 },
      { text: 'PORTONES', score: 0.8 },
    ]);
    expect(lectura).toEqual({ numero: '427', nombre: 'PORTONES' });
  });

  it('descarta candidatos de baja confianza en vez de adivinarlos', () => {
    const lectura = adivinarLectura([
      { text: '116', score: 0.1 },
      { text: 'xx', score: 0.9 },
    ]);
    expect(lectura).toEqual({ numero: null, nombre: null });
  });

  it('no toma un número de 1 dígito ni de 5: no hay líneas así', () => {
    const lectura = adivinarLectura([
      { text: '7', score: 0.9 },
      { text: '99999', score: 0.9 },
    ]);
    expect(lectura.numero).toBeNull();
  });
});

describe('frasearLectura', () => {
  it('número y nombre juntos cuando están los dos', () => {
    expect(frasearLectura({ numero: '427', nombre: 'PORTONES' }, null)).toBe(
      `${strings.reader.line} 427, PORTONES`,
    );
  });

  it('cae al texto crudo antes que al silencio', () => {
    expect(frasearLectura(null, 'DM 1234')).toBe('DM 1234');
  });

  it('sin nada legible, lo dice — no inventa', () => {
    expect(frasearLectura(null, null)).toBe(strings.reader.nothingRead);
  });
});

describe('frasearProducto', () => {
  it('producto y detalle juntos cuando están los dos', () => {
    expect(frasearProducto({ producto: 'Arroz Blue Patna', detalle: '1 kg' }, null)).toBe(
      'Arroz Blue Patna, 1 kg',
    );
  });

  it('sólo el producto si no hay detalle', () => {
    expect(frasearProducto({ producto: 'Yerba Canarias', detalle: null }, null)).toBe(
      'Yerba Canarias',
    );
  });

  it('sin nada legible, lo dice — no inventa', () => {
    expect(frasearProducto(null, null)).toBe(strings.reader.nothingReadProduct);
  });
});

describe('formatMs', () => {
  it('muestra milisegundos redondeados por debajo del segundo', () => {
    expect(formatMs(842.4)).toBe('842 ms');
  });

  it('pasa a segundos a partir de 1000 ms', () => {
    expect(formatMs(2530)).toBe('2.53 s');
  });

  it('muestra un guion cuando no hubo medición', () => {
    expect(formatMs(NaN)).toBe('—');
  });
});
