/**
 * Existe porque el techo de resolución es una decisión de latencia, no una constante decorativa, y
 * porque la regla tiene dos formas fáciles de romper sin que nada falle a la vista: restringir
 * siempre el ancho (deja las fotos verticales por encima del techo, que es el caso más común
 * sacándole una foto a una góndola) y redimensionar sin comprobar (agranda las fotos chicas, que
 * pesa más y no aporta detalle). Los dos bugs se ven sólo como "la lectura tarda más".
 */
import { calcularRedimension, LADO_MAYOR_MAX } from './redimension';

describe('calcularRedimension', () => {
  it('no toca una foto que ya entra en el techo', () => {
    expect(calcularRedimension(800, 600)).toBeNull();
    expect(calcularRedimension(LADO_MAYOR_MAX, LADO_MAYOR_MAX)).toBeNull();
  });

  it('restringe el ancho en una foto horizontal', () => {
    expect(calcularRedimension(4032, 3024)).toEqual({ width: LADO_MAYOR_MAX });
  });

  it('restringe el ALTO en una foto vertical, no el ancho', () => {
    // El caso de la góndola: el envase es más alto que ancho. Fijar el ancho dejaría el alto en
    // ~1365 px, por encima del techo.
    expect(calcularRedimension(3024, 4032)).toEqual({ height: LADO_MAYOR_MAX });
  });

  it('trata la foto cuadrada como horizontal (da igual cuál se fije)', () => {
    expect(calcularRedimension(2000, 2000)).toEqual({ width: LADO_MAYOR_MAX });
  });

  it('respeta un techo distinto al de por defecto', () => {
    expect(calcularRedimension(1200, 900, 512)).toEqual({ width: 512 });
    expect(calcularRedimension(400, 300, 512)).toBeNull();
  });

  it('no redimensiona ante dimensiones ausentes o absurdas', () => {
    // Preferimos mandar la foto entera antes que arriesgarnos a agrandarla.
    expect(calcularRedimension(undefined, 3024)).toBeNull();
    expect(calcularRedimension(4032, undefined)).toBeNull();
    expect(calcularRedimension(0, 0)).toBeNull();
    expect(calcularRedimension(-10, 3024)).toBeNull();
    expect(calcularRedimension(NaN, 3024)).toBeNull();
  });
});
