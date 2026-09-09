/**
 * Existe porque el modo de falla de esto es **silencioso en las dos direcciones**.
 *
 * Si la derivación no funciona, un build que tiene el proxy configurado pero no el secret propio
 * sale sin ninguna telemetría: la app anda igual, nadie nota nada, y el agujero recién aparece
 * cuando hace falta diagnosticar una falla y no hay una sola fila. Y si derivara de más —armando una
 * URL a la fuerza desde algo que no es la del proxy— cada lote daría 404 contra un endpoint que no
 * existe, con el mismo resultado visible: cero filas.
 *
 * Las dos URLs entran por parámetro, no por `process.env`: un test que lea el entorno mide dónde
 * corre y no qué hace el código (la lección del fallo de TestFlight del 2026-09-02).
 */
import { resolverUrlDeTelemetria, urlDeTelemetria } from './config';

const PROXY = 'https://oxukvenxiqkjhksgoigq.supabase.co/functions/v1/vision';
const TELE = 'https://oxukvenxiqkjhksgoigq.supabase.co/functions/v1/telemetria';

describe('urlDeTelemetria', () => {
  it('cambia la última parte: las dos funciones viven en el mismo proyecto', () => {
    expect(urlDeTelemetria(PROXY)).toBe(TELE);
  });

  it('tolera la barra final, que es como se pega una URL del dashboard', () => {
    expect(urlDeTelemetria(`${PROXY}/`)).toBe(TELE);
  });

  it('no adivina: lo que no termina en /vision no deriva nada', () => {
    // Una URL armada a la fuerza daría 404 en cada lote y llenaría la cola de reintentos contra un
    // endpoint que no existe. Apagada y sabida es mejor que encendida y rota.
    expect(urlDeTelemetria('https://ejemplo.test/functions/v1/otra')).toBeNull();
    expect(urlDeTelemetria('https://ejemplo.test')).toBeNull();
    expect(urlDeTelemetria('')).toBeNull();
    expect(urlDeTelemetria(undefined)).toBeNull();
  });

  it('no confunde un host que TERMINA en vision con la ruta de la función', () => {
    expect(urlDeTelemetria('https://vision')).toBeNull();
  });
});

describe('resolverUrlDeTelemetria', () => {
  it('la variable propia manda: permite apuntar a otro proyecto sin tocar el proxy', () => {
    expect(resolverUrlDeTelemetria('https://otra.test/telemetria', PROXY)).toBe(
      'https://otra.test/telemetria'
    );
  });

  it('sin variable propia, la deriva del proxy', () => {
    expect(resolverUrlDeTelemetria('', PROXY)).toBe(TELE);
    expect(resolverUrlDeTelemetria(undefined, PROXY)).toBe(TELE);
  });

  it('sin ninguna de las dos devuelve vacío, que apaga la telemetría entera', () => {
    expect(resolverUrlDeTelemetria('', '')).toBe('');
    expect(resolverUrlDeTelemetria(undefined, undefined)).toBe('');
  });
});
