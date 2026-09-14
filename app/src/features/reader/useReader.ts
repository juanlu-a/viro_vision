/**
 * Home's view of the reader.
 *
 * The pipeline itself lives in `readingService.ts` and no longer in this hook. Until 2026-09-10 it
 * lived here, which meant the device's physical button only worked while Home was mounted and only
 * after React had scheduled and committed a render — a chain that cannot be relied on when the phone
 * is locked in a pocket, which is the whole product (ADR 0003 §2). What is left here is what is
 * genuinely presentation: subscribing to the pipeline's state, and whether the device can take a
 * photo right now. Until 2026-09-14 it also condensed the device's connection into the one word of
 * Home's status line; that line lives only on the Device tab now.
 *
 * The returned shape is unchanged, so Home and its accessibility behaviour are untouched.
 */
import { useSyncExternalStore } from 'react';

import { useDevice } from '@/features/device/DeviceProvider';
import { useProductModel } from '@/features/reader/ProductModelProvider';
import { applyGesture, getReaderState, requestReading, subscribeReader } from '@/features/reader/readingService';

export type { ReaderState } from '@/features/reader/readingService';

export function useReader() {
  const state = useSyncExternalStore(subscribeReader, getReaderState, getReaderState);
  const { model } = useProductModel();
  const device = useDevice();

  return {
    state,
    applyGesture,
    read: () => requestReading('app'),
    model,
    /** The device can take the photo now: connected, with a network and answering. Without this there is no reading. */
    deviceReady: device.photoAvailable,
  };
}
