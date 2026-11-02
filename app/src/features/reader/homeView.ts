/**
 * What Home shows of the reader, by app mode. Pure, so it can be tested: a debug field leaking into
 * product mode would go unnoticed by exactly the people the app is for.
 *
 * Product mode is the clean app: the voice is the interface, so the result rows (kind, brand,
 * detail), the photos and the status and error lines are not drawn. The one line that stays is
 * "El dispositivo no pudo sacar la foto": it is the only failure the user can act on right here, by
 * pressing again. Development mode shows everything, as before.
 */
import { strings } from '@/i18n';
import type { AppMode } from '@/services/storage/appModePreference';

import { busLineRows, productRows, type ResultRow } from './result';
import type { ReaderState } from './readingService';

export interface HomeView {
  /** The single line under the read button, or null. */
  message: string | null;
  rows: ResultRow[] | null;
  photoUri: string | null;
  busShots: boolean;
  /** The "supermercado no disponible en esta versión" notice next to the mode buttons. */
  cloudNotice: boolean;
}

export function homeView(state: ReaderState, mode: AppMode, hasModel: boolean): HomeView {
  if (mode === 'product') {
    return {
      message: state.message === strings.reader.deviceCaptureFailed ? state.message : null,
      rows: null,
      photoUri: null,
      busShots: false,
      cloudNotice: false,
    };
  }
  const rows = state.product ? productRows(state.product) : state.reading ? busLineRows(state.reading) : null;
  return {
    message: state.message !== '' && !rows ? state.message : null,
    rows,
    photoUri: state.photoUri,
    busShots: state.mode === 'bus',
    cloudNotice: state.mode === 'supermarket' && !hasModel,
  };
}
