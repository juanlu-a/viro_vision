/**
 * The one line the Device tab shows about the device, and its colour.
 *
 * "Connected" used to mean only the Bluetooth link, and Home carried a second line with the state of
 * the device's WiFi. Since 2026-09-14 this is the only status line in the app, so it has to answer the
 * one question the user has: can I use it? Green "Conectado" means yes, everything is up. Amber
 * "Conectado (falta el WiFi)" means the link is there but the photo path is not yet — and nothing
 * more, because the reason and the remedy belong in the notice below, not in the headline.
 *
 * Bluetooth cannot be the missing half: without the BLE link there is no connection at all (the
 * device's WiFi credentials and address arrive over it), so that case is the plain "not connected"
 * message the connection already carries.
 *
 * It lives outside the screen so it can be tested: the tone decides the colour and the colour is
 * reinforcement only; the text is what the screen reader gets.
 */
import type { WifiState } from './DeviceProvider';
import type { ConnectionState } from './types';
import { strings } from '@/i18n';

export type ConnectionTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface ConnectionLabel {
  text: string;
  tone: ConnectionTone;
}

export function describeConnection(connection: ConnectionState, wifi: WifiState): ConnectionLabel {
  if (connection.status === 'connected') {
    return wifi === 'ready'
      ? { text: strings.connection.connected, tone: 'success' }
      : { text: strings.connection.connectedWithoutWifi, tone: 'warning' };
  }
  return {
    text: connection.message,
    tone: connection.status === 'error' ? 'danger' : 'neutral',
  };
}
