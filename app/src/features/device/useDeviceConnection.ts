/**
 * Hook that owns the BLE connection state machine for the device screen.
 *
 * Today it drives the honest stub in services/ble: `connect()` transitions through scanning and
 * then surfaces the "not implemented yet" message instead of faking a success. Once the real
 * BleClient lands, only services/ble/bleClient.ts changes — this hook and the UI stay the same.
 */
import { useCallback, useState } from 'react';

import { strings } from '@/i18n';
import { BleNotImplementedError, getBleClient } from '@/services/ble/bleClient';
import type { ConnectionState } from './types';

const initialState: ConnectionState = {
  status: 'idle',
  device: null,
  message: strings.connection.idle,
};

export function useDeviceConnection() {
  const [state, setState] = useState<ConnectionState>(initialState);

  const connect = useCallback(async () => {
    setState({ status: 'scanning', device: null, message: strings.connection.scanning });
    try {
      const device = await getBleClient().connect();
      setState({ status: 'connected', device, message: strings.connection.connected });
    } catch (err) {
      const message =
        err instanceof BleNotImplementedError
          ? strings.connection.unavailable
          : strings.connection.error;
      setState({ status: 'error', device: null, message });
    }
  }, []);

  const disconnect = useCallback(async () => {
    await getBleClient().disconnect();
    setState(initialState);
  }, []);

  return { state, connect, disconnect };
}
