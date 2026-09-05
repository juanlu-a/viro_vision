/**
 * Existe porque este texto es lo único que el usuario oye de la medición que decide el ADR 0003:
 * un decimal con punto (VoiceOver en español lo lee raro) o bytes mostrados como kilobytes cambian
 * lo que la persona anota en la tabla de mediciones.
 */
import { describirMedicion } from './medicion';

describe('describirMedicion', () => {
  it('habla en kilobytes, segundos y KB/s con coma decimal', () => {
    const texto = describirMedicion({ bytes: 53_000, chunks: 298, chunkBytes: 182, ms: 2970, kbps: 53_000 / 2970 });
    expect(texto).toBe(
      '53 kilobytes en 2,97 segundos: 17,8 kilobytes por segundo, en 298 paquetes de 182 bytes.'
    );
  });

  it('muestra un decimal en los kilobytes cuando no son redondos', () => {
    expect(describirMedicion({ bytes: 34_500, chunks: 1, chunkBytes: 20, ms: 1, kbps: 34_500 })).toMatch(
      /^34,5 kilobytes/
    );
  });
});
