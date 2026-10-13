/**
 * A cache folder that keeps only its newest files.
 *
 * Every reading used to leave a JPEG (`device-photos/`) and, on the device path, an MP3
 * (`readings/`) behind, and nothing ever deleted them: a phone used all day grew its cache without
 * bound (found 2026-10-06). The names written into these folders sort by time, so "newest" is the
 * last ones by name and no file metadata has to be read.
 *
 * Pruning never throws: a file that cannot be deleted costs disk, and a reading that failed because
 * of it would cost the user.
 */
import { Directory, Paths } from 'expo-file-system';

/** Returns the folder, created if needed, after deleting all but its `keep` newest entries. */
export function cacheFolder(name: string, keep: number): Directory {
  const folder = new Directory(Paths.cache, name);
  if (!folder.exists) {
    folder.create({ idempotent: true });
    return folder;
  }
  try {
    const entries = folder.list().sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries.slice(0, Math.max(0, entries.length - keep))) {
      try {
        entry.delete();
      } catch {
        // Best-effort, see above.
      }
    }
  } catch {
    // Best-effort, see above.
  }
  return folder;
}
