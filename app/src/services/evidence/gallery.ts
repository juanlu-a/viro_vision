/**
 * Bus mode's pictures on the phone's screen: for each bus the device saw, the frame it was detected in
 * and the banner crop of every OCR read, with what the OCR made of it.
 *
 * TEMPORARY — DEVELOPMENT ONLY, removed before the final version with the rest of the evidence path
 * (see `evidence.ts`).
 *
 * The supermarket shows the photo behind its reading on Home; bus mode had nothing to show, because
 * the device reads on its own and only the result came over BLE. This is the same idea for bus mode,
 * built on the pictures the evidence path already pulls: one entry per bus (`<run>/t003`), newest
 * first, the oldest evicted past `max` so the phone's cache does not grow with a day of buses.
 *
 * Pure module: the pictures arrive as URIs of files `service.ts` already wrote, and an eviction hands
 * those URIs back so it can delete them.
 */
import type { EvidenceRecord } from './evidence';

export interface ReadShot {
  attempt: number;
  /** The banner crop the OCR was given. */
  cropUri: string | null;
  /** The whole frame with the bus and the crop marked; only when the OCR returned text. */
  frameUri: string | null;
  /** Everything the OCR returned, joined; empty when it returned nothing. */
  text: string;
  number: string | null;
  destination: string | null;
}

export interface BusShot {
  /** `<run>/t003`. */
  key: string;
  track: number;
  /** The device's clock, `HH:MM:SS`, of the first record of this bus. */
  time: string | null;
  /** The frame the bus was detected in, with the detections drawn. */
  busUri: string | null;
  /** In the order they were read. */
  reads: ReadShot[];
  decided: { number: string | null; destination: string | null; announced: boolean } | null;
}

export interface Gallery {
  /** One record and the URIs of its pictures, by file name. */
  add(record: EvidenceRecord, uris: Record<string, string>): void;
  get(): readonly BusShot[];
  subscribe(listener: () => void): () => void;
}

export const MAX_BUSES = 10;

function keyOf(ref: string): string | null {
  const m = /^(.+\/t\d{3})-/.exec(ref);
  return m ? m[1] : null;
}

function timeOf(wall: string | undefined): string | null {
  const m = wall ? /(\d{2}:\d{2}:\d{2})/.exec(wall) : null;
  return m ? m[1] : null;
}

function urisOf(shot: BusShot): string[] {
  const uris = shot.reads.flatMap((r) => [r.cropUri, r.frameUri]);
  return [shot.busUri, ...uris].filter((u): u is string => u !== null);
}

export function createGallery({ max = MAX_BUSES, onEvict }: { max?: number; onEvict?: (uris: string[]) => void } = {}): Gallery {
  let shots: readonly BusShot[] = [];
  const listeners = new Set<() => void>();

  return {
    add(record, uris) {
      const key = keyOf(record.ref);
      if (key === null) return;
      const pick = (suffix: string) => Object.entries(uris).find(([name]) => name.endsWith(suffix))?.[1] ?? null;
      const existing = shots.find((s) => s.key === key);
      const shot: BusShot = existing
        ? { ...existing, reads: [...existing.reads] }
        : { key, track: record.track ?? 0, time: timeOf(record.wall), busUri: null, reads: [], decided: null };

      if (record.what === 'bus') {
        shot.busUri = pick('-bus.jpg') ?? shot.busUri;
      } else if (record.what === 'read') {
        shot.reads.push({
          attempt: record.attempt ?? shot.reads.length + 1,
          cropUri: pick('-crop.jpg'),
          frameUri: pick('-frame.jpg'),
          text: (record.texts ?? []).map((t) => t.text).join(' '),
          number: record.number ?? null,
          destination: record.destination ?? null,
        });
        shot.reads.sort((a, b) => a.attempt - b.attempt);
      } else if (record.what === 'decided') {
        shot.decided = { number: record.number ?? null, destination: record.destination ?? null, announced: record.announced ?? false };
      } else {
        return;
      }

      const rest = shots.filter((s) => s.key !== key);
      // A bus already on screen keeps its place: its reads arrive while newer buses may have appeared,
      // and jumping it to the top would move what someone is looking at.
      const next = existing ? shots.map((s) => (s.key === key ? shot : s)) : [shot, ...rest];
      const evicted = next.slice(max);
      shots = next.slice(0, max);
      if (evicted.length > 0) onEvict?.(evicted.flatMap(urisOf));
      listeners.forEach((l) => l());
    },
    get: () => shots,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
