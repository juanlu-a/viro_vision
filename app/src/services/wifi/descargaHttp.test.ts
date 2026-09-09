/**
 * Existe porque esta URL es la que la app le arma a la placa para pedirle la foto, y la ip y el
 * puerto no son constantes: llegan por la característica `estado` del GATT y cambian cada vez que
 * la placa enciende o apaga su AP. Un esquema o un separador mal puestos dan un fetch que falla con
 * un mensaje de red, indistinguible de una placa apagada.
 */
import { urlDeLaPlaca } from './descargaHttp';

describe('urlDeLaPlaca', () => {
  it('arma la URL en HTTP plano con la ip y el puerto que llegan por el GATT', () => {
    expect(urlDeLaPlaca({ ip: '192.168.1.145', puerto: 8080 }, '/fotos/ultima')).toBe(
      'http://192.168.1.145:8080/fotos/ultima'
    );
  });
});
