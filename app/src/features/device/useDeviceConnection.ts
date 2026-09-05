/**
 * Hook que lleva la máquina de estados de la conexión BLE para la pantalla Dispositivo.
 *
 * Habla sólo con la interfaz `BleClient`: si atrás hay el cliente real o el stub lo decide
 * `services/ble`. Los mensajes se eligen por el TIPO de error, nunca parseando strings.
 */
import { useCallback, useEffect, useState } from 'react';

import { strings } from '@/i18n';
import {
  BleDeviceNotFoundError,
  BleNotConnectedError,
  BleNotImplementedError,
  getBleClient,
} from '@/services/ble/bleClient';
import { BleTransferError, type MedicionTransferencia } from '@/services/ble/transferencia';
import { medirDescargaHttp, urlDeLaPlaca } from '@/services/wifi/descargaHttp';
import { BYTES_FOTO_REFERENCIA, describirMedicion, describirMedicionWifi } from './medicion';
import type { ConnectionState } from './types';

const initialState: ConnectionState = {
  status: 'idle',
  device: null,
  message: strings.connection.idle,
};

export interface EstadoMedicion {
  midiendo: boolean;
  medicion: MedicionTransferencia | null;
  /** Mensaje listo para mostrar y anunciar; null si no hay nada que decir. */
  mensaje: string | null;
}

const sinMedicion: EstadoMedicion = { midiendo: false, medicion: null, mensaje: null };

function mensajeDeError(err: unknown): string {
  if (err instanceof BleNotImplementedError) return strings.connection.unavailable;
  if (err instanceof BleDeviceNotFoundError) return strings.connection.notFound;
  return strings.connection.error;
}

export function useDeviceConnection() {
  const [state, setState] = useState<ConnectionState>(initialState);
  const [medicion, setMedicion] = useState<EstadoMedicion>(sinMedicion);

  // Si el enlace se cae solo, la pantalla tiene que decirlo: el usuario no ve la placa.
  useEffect(
    () =>
      getBleClient().onDisconnect(() => {
        setState({ status: 'error', device: null, message: strings.connection.lost });
        setMedicion(sinMedicion);
      }),
    []
  );

  const connect = useCallback(async () => {
    setState({ status: 'scanning', device: null, message: strings.connection.scanning });
    setMedicion(sinMedicion);
    try {
      const device = await getBleClient().connect();
      setState({ status: 'connected', device, message: strings.connection.connected });
    } catch (err) {
      setState({ status: 'error', device: null, message: mensajeDeError(err) });
    }
  }, []);

  const disconnect = useCallback(async () => {
    await getBleClient().disconnect();
    setState(initialState);
    setMedicion(sinMedicion);
  }, []);

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
        setState(initialState);
      }
      setMedicion({ midiendo: false, medicion: null, mensaje });
      return mensaje;
    }
  }, []);

  // Plan B del ADR 0003: la misma foto de referencia, pero bajada por HTTP desde la placa. La
  // dirección llega por BLE (característica `estado`); BLE sigue siendo el plano de control.
  const medirWifi = useCallback(async (): Promise<string> => {
    const direccion = state.device?.direccion;
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
  }, [state.device]);

  return { state, connect, disconnect, medir, medirWifi, medicion };
}
