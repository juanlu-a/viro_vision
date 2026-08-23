/**
 * Existe porque el firmware va a implementar ESTA MISMA máquina sobre el botón físico
 * (ADR 0007): si alguien le agrega a la app una transición que el botón no tiene —el salto
 * directo entre modos es la tentación obvia—, la app y el dispositivo pasan a contarle al
 * usuario historias distintas y no hay pantalla que lo delate. La tabla replica el diagrama
 * canónico de `docs/architecture/README.md` caso por caso; ante desacuerdo, manda el diagrama.
 */
import { GESTOS, MODOS, transicionar } from './modes';
import type { Gesto, Modo } from './modes';

describe('transicionar', () => {
  const esperado: Record<Modo, Record<Gesto, Modo>> = {
    esperando: { click: 'omnibus', dobleClick: 'supermercado', clickLargo: 'esperando' },
    omnibus: { click: 'omnibus', dobleClick: 'omnibus', clickLargo: 'esperando' },
    supermercado: { click: 'supermercado', dobleClick: 'supermercado', clickLargo: 'esperando' },
  };

  for (const modo of MODOS) {
    for (const gesto of GESTOS) {
      it(`${modo} + ${gesto} → ${esperado[modo][gesto]}`, () => {
        expect(transicionar(modo, gesto)).toBe(esperado[modo][gesto]);
      });
    }
  }

  it('no permite saltar de un modo al otro sin pasar por esperando', () => {
    expect(transicionar('omnibus', 'dobleClick')).not.toBe('supermercado');
    expect(transicionar('supermercado', 'click')).not.toBe('omnibus');
  });
});
