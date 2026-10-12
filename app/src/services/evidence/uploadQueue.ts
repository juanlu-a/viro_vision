/**
 * The pictures waiting for internet, kept on the phone until the `evidence` function stores them.
 *
 * Uploading fails often, by design, for the same reason telemetry does (`telemetry/recorder.ts`): in
 * the street the phone is joined to the device's access point, which has no internet. So every
 * pulled picture is written to disk first and uploaded when a send works; the `bus.evidence` row was
 * already recorded with the paths it will have.
 *
 * Bounded (MAX_PENDING): a day without internet must not fill the phone. Past it the oldest are
 * dropped, and a row says so — a picture the row points at that never arrives has to be explainable.
 *
 * Storage and network are injected: the logic is tested without either.
 */
export interface PendingUpload {
  phone: string;
  ref: string;
  files: { name: string; base64: string }[];
}

/** Keys sort by age: the caller writes them with a timestamp prefix. */
export interface PendingStore {
  keys(): string[];
  read(key: string): PendingUpload | null;
  write(key: string, item: PendingUpload): void;
  remove(key: string): void;
}

export type Upload = (item: PendingUpload) => Promise<void>;

/** ~150 KB each at most (a frame and a crop, base64): a few tens of MB in the worst case. */
export const MAX_PENDING = 150;
/** After a failed send, how long before the next try. The phone on the AP fails every time. */
export const RETRY_MS = 60_000;

export interface UploadQueue {
  enqueue(item: PendingUpload): void;
  drain(): Promise<void>;
  pending(): number;
}

export function createUploadQueue({
  store,
  upload,
  onDropped,
  onFailed,
  now = Date.now,
  schedule = setTimeout,
}: {
  store: PendingStore;
  upload: Upload;
  onDropped: (ref: string) => void;
  onFailed: (message: string, pending: number) => void;
  now?: () => number;
  schedule?: (run: () => void, ms: number) => unknown;
}): UploadQueue {
  let draining = false;
  let failedAt = Number.NEGATIVE_INFINITY;
  let retryScheduled = false;
  let counter = 0;

  function scheduleRetry(): void {
    if (retryScheduled) return;
    retryScheduled = true;
    schedule(() => {
      retryScheduled = false;
      void drain();
    }, RETRY_MS);
  }

  async function drain(): Promise<void> {
    if (draining || now() - failedAt < RETRY_MS) return;
    draining = true;
    try {
      for (const key of store.keys()) {
        const item = store.read(key);
        if (item === null) {
          store.remove(key); // unreadable: it will never upload
          continue;
        }
        try {
          await upload(item);
        } catch (err) {
          // One failure stops the round: without internet every other item fails the same way, and
          // trying them all is battery for nothing.
          failedAt = now();
          onFailed(err instanceof Error ? err.message : String(err), store.keys().length);
          scheduleRetry();
          return;
        }
        store.remove(key);
      }
    } finally {
      draining = false;
    }
  }

  return {
    enqueue(item) {
      counter += 1;
      store.write(`${String(now()).padStart(15, '0')}-${String(counter).padStart(6, '0')}`, item);
      const keys = store.keys();
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_PENDING))) {
        const old = store.read(key);
        store.remove(key);
        onDropped(old?.ref ?? key);
      }
      void drain();
    },
    drain,
    pending: () => store.keys().length,
  };
}
