import { strings } from '@/i18n';

import { homeView } from './homeView';
import type { ReaderState } from './readingService';

const base: ReaderState = {
  mode: 'supermarket',
  status: 'idle',
  message: '',
  progress: null,
  reading: null,
  product: null,
  photoUri: null,
  failure: null,
  resultPhrase: null,
};

const withProduct: ReaderState = {
  ...base,
  message: 'Yerba, Canarias.',
  resultPhrase: 'Yerba, Canarias.',
  product: { kind: 'Yerba', brand: 'Canarias', detail: null },
  photoUri: 'file:///photo.jpg',
};

describe('homeView, product mode', () => {
  it('draws the phrase that was said, but no result rows, photo or bus shots', () => {
    expect(homeView(withProduct, 'product', true)).toEqual({
      message: 'Yerba, Canarias.',
      messageIsResult: true,
      rows: null,
      photoUri: null,
      busShots: false,
      cloudNotice: false,
    });
    expect(homeView({ ...base, mode: 'bus' }, 'product', true).busShots).toBe(false);
  });

  it('keeps only the failed-capture line, without the result caption', () => {
    const failed: ReaderState = {
      ...base,
      message: strings.reader.deviceCaptureFailed,
      failure: 'deviceCapture',
      photoUri: 'file:///old.jpg',
    };
    const view = homeView(failed, 'product', true);
    expect(view.message).toBe(strings.reader.deviceCaptureFailed);
    expect(view.messageIsResult).toBe(false);
    expect(view.photoUri).toBeNull();
    for (const message of [strings.reader.error, strings.reader.readTimedOut, strings.reader.cloudUnavailable, strings.reader.readingFromDevice]) {
      expect(homeView({ ...base, message }, 'product', true).message).toBeNull();
    }
  });

  it('hides the "not in this version" notice', () => {
    expect(homeView(base, 'product', false).cloudNotice).toBe(false);
  });
});

describe('homeView, development mode', () => {
  it('shows the rows and the photo, and not the phrase twice', () => {
    const view = homeView(withProduct, 'development', true);
    expect(view.rows?.map((r) => r.label)).toEqual([
      strings.reader.productField,
      strings.reader.brandField,
      strings.reader.detailField,
    ]);
    expect(view.message).toBeNull();
    expect(view.photoUri).toBe('file:///photo.jpg');
  });

  it('shows any message when there is no result', () => {
    const view = homeView({ ...base, message: strings.reader.error }, 'development', true);
    expect(view.message).toBe(strings.reader.error);
    expect(view.messageIsResult).toBe(true);
  });

  it('shows the bus shots in bus mode and the notice without a model', () => {
    expect(homeView({ ...base, mode: 'bus' }, 'development', true).busShots).toBe(true);
    expect(homeView(base, 'development', false).cloudNotice).toBe(true);
  });
});
