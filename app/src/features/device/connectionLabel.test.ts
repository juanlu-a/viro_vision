/**
 * Exists because "Conectado" is the only status line left in the app (Home lost its own on
 * 2026-09-14), so it has to mean "fully usable" and never say green while the photo path is down. If
 * someone wires the label straight to the BLE state again, the user would see a green "Conectado" and
 * a read button that does nothing.
 */
import { strings } from '@/i18n';

import { describeConnection } from './connectionLabel';
import type { ConnectionState } from './types';

const connected: ConnectionState = {
  status: 'connected',
  device: { id: 'x', name: 'ViroVision', batteryLevel: 80, firmwareVersion: null, address: null, ap: true },
  message: strings.connection.connected,
};

describe('describeConnection', () => {
  it('is green "Conectado" only when the WiFi is ready too', () => {
    expect(describeConnection(connected, 'ready')).toEqual({
      text: strings.connection.connected,
      tone: 'success',
    });
  });

  it.each(['off', 'joining', 'error'] as const)('is amber and names the WiFi as missing when it is %s', (wifi) => {
    const label = describeConnection(connected, wifi);
    expect(label.tone).toBe('warning');
    expect(label.text).toBe(strings.connection.connectedWithoutWifi);
    expect(label.text).toMatch(/Conectado/);
    expect(label.text).toMatch(/WiFi/);
  });

  it('passes the connection message through when there is no link', () => {
    const lost: ConnectionState = { status: 'error', device: null, message: strings.connection.lost };
    expect(describeConnection(lost, 'off')).toEqual({ text: strings.connection.lost, tone: 'danger' });
    const scanning: ConnectionState = { status: 'scanning', device: null, message: strings.connection.scanning };
    expect(describeConnection(scanning, 'off')).toEqual({ text: strings.connection.scanning, tone: 'neutral' });
  });
});
