/**
 * Exists because this function decides which files get deleted. "Newest" is "last by name", which
 * only holds while the writers keep sortable names (`device-<ms>.jpg`, `reading-<iso>.mp3`); and a
 * delete that throws must never fail the reading that triggered the prune.
 */
import { cacheFolder } from './cacheFolder';

const mockEntries: { name: string; deleted: boolean; throws?: boolean; delete: () => void }[] = [];
let mockExists = true;
let mockCreated = 0;

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  Directory: class {
    get exists() {
      return mockExists;
    }
    create() {
      mockCreated += 1;
    }
    list() {
      return [...mockEntries];
    }
  },
}));


function entry(name: string, throws = false) {
  const e = {
    name,
    deleted: false,
    throws,
    delete() {
      if (throws) throw new Error('busy');
      e.deleted = true;
    },
  };
  return e;
}

beforeEach(() => {
  mockEntries.length = 0;
  mockExists = true;
  mockCreated = 0;
});

describe('cacheFolder', () => {
  it('keeps only the newest entries by name', () => {
    mockEntries.push(entry('device-300.jpg'), entry('device-100.jpg'), entry('device-200.jpg'));
    cacheFolder('device-photos', 1);
    expect(mockEntries.filter((e) => e.deleted).map((e) => e.name).sort()).toEqual(['device-100.jpg', 'device-200.jpg']);
  });

  it('creates a missing folder and deletes nothing', () => {
    mockExists = false;
    cacheFolder('readings', 1);
    expect(mockCreated).toBe(1);
  });

  it('survives a delete that throws and keeps going', () => {
    mockEntries.push(entry('a', true), entry('b'), entry('c'));
    expect(() => cacheFolder('x', 1)).not.toThrow();
    expect(mockEntries.find((e) => e.name === 'b')?.deleted).toBe(true);
  });
});
