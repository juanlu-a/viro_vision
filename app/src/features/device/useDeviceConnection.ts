/**
 * Hook que lleva la máquina de estados de la conexión BLE para la pantalla Dispositivo.
 *
 * Habla sólo con la interfaz `BleClient`: si atrás hay el cliente real o el stub lo decide
 * `services/ble`. Los mensajes se eligen por el TIPO de error, nunca parseando strings.
 */
import { useCallback, useState } from 'react';

import { strings } from '@/i18n';
import {
  BleDeviceNotFoundError,
  BleNotConnectedError,
  BleNotImplementedError,
  getBleClient,
} from '@/services/ble/bleClient';
import { BleTransferError, type MedicionTransferencia } from '@/services/ble/transferencia';
import { BYTES_FOTO_REFERENCIA, describirMedicion } from './medicion';
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
      let mensaje: string = strings.connect.measureFailed;
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

  return { state, connect, disconnect, medir, medicion };
}
