/**
 * Existe porque todo lo que la app le dice a la placa y todo lo que la placa le contesta pasa por
 * acá: el modo que se escribe, el JSON de `estado`, las credenciales del WiFi y el MP3 que sube al
 * parlante. Un relleno mal calculado no rompe nada a la vista — produce bytes que la placa
 * interpreta como otra cosa.
 */
import {
  codificarBase64,
  codificarTextoBase64,
  decodificarBase64,
  decodificarTextoBase64,
} from './base64';

describe('base64', () => {
  it('ida y vuelta de bytes arbitrarios, incluidos los rellenos de 1 y 2 bytes', () => {
    for (const largo of [0, 1, 2, 3, 4, 5, 182]) {
      const bytes = new Uint8Array(Array.from({ length: largo }, (_, i) => (i * 37 + 11) & 0xff));
      expect(Array.from(decodificarBase64(codificarBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('coincide con el base64 estándar que produce la placa', () => {
    expect(codificarTextoBase64('{"cmd":"foto"}')).toBe('eyJjbWQiOiJmb3RvIn0=');
    expect(decodificarTextoBase64('eyJ0IjoibW9kbyJ9')).toBe('{"t":"modo"}');
  });
});
