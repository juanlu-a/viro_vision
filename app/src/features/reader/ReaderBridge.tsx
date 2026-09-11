/**
 * Wires the reading pipeline (`readingService.ts`) to React, and to the device's button.
 *
 * It renders nothing. It exists because the pipeline deliberately stopped being a hook on
 * 2026-09-10: a press of the physical button has to start a reading whatever is on screen and
 * whether or not anything is on screen at all — the phone is in the user's pocket. Something still
 * has to hand the module the app's live values, and this is that something.
 *
 * **The deps go in as getters over a ref**, never as captured values. The subscription is installed
 * once, at mount, and the model the user chose in Settings is read at the instant of the reading.
 * Passing `model` itself would mean re-registering on every change and would put us one refactor
 * away from a reading that uses yesterday's model — the exact bug `ProductModelProvider` exists to
 * prevent, re-created one layer down.
 *
 * It is mounted in the root layout, above the navigator: it must outlive every screen.
 */
import { useEffect, useRef } from 'react';

import { useDevice } from '@/features/device/DeviceProvider';
import { useProductModel } from '@/features/reader/ProductModelProvider';
import { configureReader, requestReading, setModeFromDevice } from '@/features/reader/readingService';
import { getBleClient } from '@/services/ble/bleClient';

export function ReaderBridge() {
  const { model } = useProductModel();
  const device = useDevice();

  // Refreshed after every render, read at the instant of a reading. A ref and not state: nothing
  // here should cause a render, it only has to be current when the button is pressed. The write is
  // in an effect with no dependency array —not during render— because a ref written while
  // rendering is a ref the React Compiler is allowed to see twice.
  const latest = useRef({ model, device });
  useEffect(() => {
    latest.current = { model, device };
  });

  useEffect(() => {
    configureReader({
      getModel: () => latest.current.model,
      downloadPhoto: (options) => latest.current.device.downloadPhoto(options),
      sendAudio: (uri) => latest.current.device.sendAudio(uri),
      writeMode: (mode) => latest.current.device.writeMode(mode),
    });
  }, []);

  // The reader subscribes to the button ITSELF rather than receiving it from `DeviceProvider`. Two
  // reasons: it keeps a hardware interrupt from travelling through React state (which is what broke
  // it with the screen locked), and it avoids a `features/device` → `features/reader` import edge
  // that would close a module-scope cycle.
  useEffect(() => getBleClient().onReadRequest(() => void requestReading('device')), []);

  // The mode reported by the device (physical button, ADR 0007) wins: the app mirrors and announces it.
  const deviceMode = device.deviceMode;
  useEffect(() => {
    if (deviceMode) setModeFromDevice(deviceMode);
  }, [deviceMode]);

  return null;
}
