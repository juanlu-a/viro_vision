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

import { announce, announceRecognition } from '@/features/audio/announcer';
import { getAudioOutput } from '@/features/audio/audioOutput';
import { useAudioOutput } from '@/features/audio/AudioOutputProvider';
import { configureNotices } from '@/features/audio/systemNotice';
import { useDevice } from '@/features/device/DeviceProvider';
import { MODE_FROM_GATT } from '@/features/device/gatt';
import { useProductModel } from '@/features/reader/ProductModelProvider';
import { configureReader, readFromDevice, setModeFromDevice } from '@/features/reader/readingService';
import { getBleClient } from '@/services/ble/bleClient';
import { strings } from '@/i18n';

export function ReaderBridge() {
  const { model } = useProductModel();
  const device = useDevice();
  const { output } = useAudioOutput();

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
      // `photoAvailable` and not `connection.status`: it is the same condition `sendAudio` needs
      // (connected, on the device's network, and `/health` answering), so asking anything weaker
      // would pay for a synthesis the device cannot receive.
      isDeviceReady: () => latest.current.device.photoAvailable,
      hushDevice: () => getBleClient().hushDevice(),
    });
    // The system notices reach the board from here too, and through the SAME client the readings
    // use, so "where is ViroVision heard" has one answer and not two.
    //
    // `isLinked` and not `photoAvailable`, unlike the reading above, and that is the whole point of
    // the notices: they are pre-recorded clips played over BLE, so they need the link and nothing
    // else — no WiFi, no cloud, no key. Asking for `photoAvailable` here would send every network
    // notice to the phone at exactly the moment the network is what broke.
    configureNotices({
      isLinked: () => getBleClient().isLinked(),
      playNotice: (clip) => getBleClient().playNotice(clip),
      hushDevice: () => getBleClient().hushDevice(),
    });
  }, []);

  // The reader subscribes to the button ITSELF rather than receiving it from `DeviceProvider`. Two
  // reasons: it keeps a hardware interrupt from travelling through React state (which is what broke
  // it with the screen locked), and it avoids a `features/device` → `features/reader` import edge
  // that would close a module-scope cycle.
  //
  // All this does is turn the GATT number into a mode: applying it before the reading —and why that
  // ordering is the fix for the double click that took no photo— lives in `readFromDevice`, where it
  // can be tested without a screen.
  useEffect(
    () =>
      getBleClient().onReadRequest((gattMode) => {
        void readFromDevice(gattMode === null ? null : MODE_FROM_GATT[gattMode] ?? null);
      }),
    [],
  );

  // Bus readings arrive on their own: the device is watching, and the user cannot see the bus coming.
  // Whoever speaks them is the user's choice, and the two halves of that choice live in two places -
  // the device stops speaking because it was told to (the effect below), and the phone starts because
  // of this subscription. Before 2026-09-15 neither half existed and a bus reading always came out of
  // the board, whatever Settings said.
  //
  // `getAudioOutput()` and not the React value: the subscription is installed once, and reading the
  // captured value would announce according to the setting as it was at mount.
  useEffect(
    () =>
      getBleClient().onRecognition((event) => {
        if (getAudioOutput() === 'phone') void announceRecognition(event);
      }),
    [],
  );

  // «Se acerca un ómnibus», under the same rule as the reading it precedes: the board says it with
  // its own clip when the output is the device, the phone says it when it is the phone. Added
  // 2026-09-22, when a real run showed it could not be heard on the phone at all — the board was
  // playing it into a speaker the user had turned off and putting nothing on the wire.
  useEffect(
    () =>
      getBleClient().onBusApproaching(() => {
        if (getAudioOutput() === 'phone') void announce(strings.reader.announceBusApproaching);
      }),
    [],
  );

  // The device learns where to speak on every connection and on every change of the setting. Both,
  // not one: it forgets on reboot, and the user can change their mind while connected.
  const connected = device.connection.status === 'connected';
  useEffect(() => {
    if (connected) void device.writeAudioTarget(output);
    // `device.writeAudioTarget` is stable per connection state; depending on `device` itself would
    // re-send on every unrelated field it carries (wifi, photoAvailable, the last notice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, output]);

  // The mode reported by the device (physical button, ADR 0007) wins: the app mirrors and announces it.
  const deviceMode = device.deviceMode;
  useEffect(() => {
    if (deviceMode) setModeFromDevice(deviceMode);
  }, [deviceMode]);

  return null;
}
