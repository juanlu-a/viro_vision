/**
 * Exists because in the street uploads fail by design — the phone is on the device's access point,
 * with no internet — and the pictures must survive that without filling the phone or hammering a
 * network that is not there.
 */
import { MAX_PENDING, RETRY_MS, createUploadQueue, type PendingStore, type PendingUpload } from './uploadQueue';

function memoryStore(): PendingStore & { items: Map<string, PendingUpload> } {
  const items = new Map<string, PendingUpload>();
  return {
    items,
    keys: () => [...items.keys()].sort(),
    read: (key) => items.get(key) ?? null,
    write: (key, item) => void items.set(key, item),
    remove: (key) => void items.delete(key),
  };
}

const item = (ref: string): PendingUpload => ({ phone: 'p', ref, files: [{ name: 't001-bus.jpg', base64: '/9g=' }] });
const flush = () => new Promise((resolve) => setImmediate(resolve));

it('uploads in order and forgets what was stored', async () => {
  const store = memoryStore();
  const sent: string[] = [];
  const queue = createUploadQueue({ store, upload: async (i) => void sent.push(i.ref), onDropped: jest.fn(), onFailed: jest.fn(), schedule: jest.fn() });
  queue.enqueue(item('a'));
  await flush();
  queue.enqueue(item('b'));
  await flush();
  expect(sent).toEqual(['a', 'b']);
  expect(queue.pending()).toBe(0);
});

it('without internet keeps everything, reports once per round and waits before trying again', async () => {
  const store = memoryStore();
  let clock = 1_000;
  const onFailed = jest.fn();
  const upload = jest.fn(async (): Promise<void> => {
    throw new Error('Network request failed');
  });
  const schedule = jest.fn();
  const queue = createUploadQueue({ store, upload, onDropped: jest.fn(), onFailed, now: () => clock, schedule });
  queue.enqueue(item('a'));
  await flush();
  queue.enqueue(item('b'));
  queue.enqueue(item('c'));
  await flush();
  expect(upload).toHaveBeenCalledTimes(1);
  expect(onFailed).toHaveBeenCalledTimes(1);
  expect(queue.pending()).toBe(3);
  expect(schedule).toHaveBeenCalledWith(expect.any(Function), RETRY_MS);

  upload.mockImplementation(async () => {});
  clock += RETRY_MS;
  await queue.drain();
  expect(queue.pending()).toBe(0);
});

it('drops the oldest past the cap, and says which', async () => {
  const store = memoryStore();
  const onDropped = jest.fn();
  let clock = 0;
  const queue = createUploadQueue({
    store,
    upload: async () => {
      throw new Error('offline');
    },
    onDropped,
    onFailed: jest.fn(),
    now: () => ++clock,
    schedule: jest.fn(),
  });
  for (let i = 0; i < MAX_PENDING + 2; i++) queue.enqueue(item(`r${i}`));
  await flush();
  expect(queue.pending()).toBe(MAX_PENDING);
  expect(onDropped.mock.calls.map((c) => c[0])).toEqual(['r0', 'r1']);
});
