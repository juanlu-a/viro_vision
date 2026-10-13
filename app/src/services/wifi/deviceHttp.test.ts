/**
 * Exists because this URL is the one the app builds to ask the device for the photo, and the ip and
 * the port are not constants: they arrive through the GATT `status` characteristic and change every
 * time the device turns its AP on or off. A misplaced scheme or separator gives a fetch that fails
 * with a network message, indistinguishable from a device that is switched off.
 */
import { deviceUrl } from './deviceHttp';

describe('deviceUrl', () => {
  it('builds the plain-HTTP URL with the ip and port that arrive over GATT', () => {
    expect(deviceUrl({ ip: '192.168.1.145', port: 8080 }, '/photos/latest')).toBe(
      'http://192.168.1.145:8080/photos/latest'
    );
  });
});
