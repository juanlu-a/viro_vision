/**
 * Hook de la pantalla Dispositivo: la conexión viene del `DispositivoProvider` (compartida con
 * Inicio); acá sólo viven las mediciones de transferencia del spike del ADR 0003.
 */
import { useCallback, useState } from 'react';

import { strings } from '@/i18n';
import { BleNotConnectedError, getBleClient } from '@/services/ble/bleClient';
import { BleTransferError, type MedicionTransferencia } from '@/services/ble/transferencia';
import { medirDescargaHttp, urlDeLaPlaca } from '@/services/wifi/descargaHttp';

import { useDispositivo } from './DispositivoProvider';
import { BYTES_FOTO_REFERENCIA, describirMedicion, describirMedicionWifi } from './medicion';

export interface EstadoMedicion {
  midiendo: boolean;
  medicion: MedicionTransferencia | null;
  /** Mensaje listo para mostrar y anunciar; null si no hay nada que decir. */
  mensaje: string | null;
}

const sinMedicion: EstadoMedicion = { midiendo: false, medicion: null, mensaje: null };

export function useDeviceConnection() {
  const dispositivo = useDispositivo();
  const [medicion, setMedicion] = useState<EstadoMedicion>(sinMedicion);

  const medir = useCallback(async (): Promise<string> => {
    setMedicion({ midiendo: true, medicion: null, mensaje: strings.connect.measuring });
    try {
      const resultado = await getBleClient().medirTransferencia(BYTES_FOTO_REFERENCIA);
      const mensaje = describirMedicion(resultado);
      setMedicion({ midiendo: false, medicion: resultado, mensaje });
      return mensaje;
    } catch (err) {
      // El detalle del error va a la pantalla y a la voz: es lo único que permite diagnosticar
      // una medición fallida a distancia (2026-09-05: dos fallos sin ninguna pista visible).
      let mensaje: string = `${strings.connect.measureFailed} ${err instanceof Error ? err.message : String(err)}`;
      if (err instanceof BleTransferError && err.faltantes.length > 0) {
        mensaje = strings.connect.measureIncomplete.replace('{faltantes}', String(err.faltantes.length));
      } else if (err instanceof BleNotConnectedError) {
        mensaje = strings.connection.idle;
      }
      setMedicion({ midiendo: false, medicion: null, mensaje });
      return mensaje;
    }
  }, []);

  // Plan B del ADR 0003: la misma foto de referencia, bajada por HTTP desde la placa.
  const medirWifi = useCallback(async (): Promise<string> => {
    const { direccion } = dispositivo;
    if (!direccion) {
      const mensaje = strings.connect.measureWifiNoAddress;
      setMedicion({ midiendo: false, medicion: null, mensaje });
      return mensaje;
    }
    setMedicion({ midiendo: true, medicion: null, mensaje: strings.connect.measuring });
    try {
      const resultado = await medirDescargaHttp(urlDeLaPlaca(direccion, `/medir/${BYTES_FOTO_REFERENCIA}`));
      const mensaje = describirMedicionWifi(resultado);
      setMedicion({ midiendo: false, medicion: resultado, mensaje });
      return mensaje;
    } catch (err) {
      const mensaje = `${strings.connect.measureFailed} ${err instanceof Error ? err.message : String(err)}`;
      setMedicion({ midiendo: false, medicion: null, mensaje });
      return mensaje;
    }
  }, [dispositivo]);

  return {
    state: dispositivo.conexion,
    direccion: dispositivo.direccion,
    wifi: dispositivo.wifi,
    wifiDetalle: dispositivo.wifiDetalle,
    connect: dispositivo.connect,
    disconnect: dispositivo.disconnect,
    medir,
    medirWifi,
    medicion,
  };
}
