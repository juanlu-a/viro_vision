/**
 * Exists because the two halves of a system notice live in different languages, in different
 * folders, and fail silently when they disagree.
 *
 * The app sends a file name over BLE; the board looks it up in `hardware/raspi/virovision/notices.py`
 * and plays it. A name in one and not the other produces no error the user can reach — the board
 * logs "unknown notice" into a journal nobody is reading and the glasses simply stay quiet, which
 * for someone who cannot see the screen is indistinguishable from a device that died.
 *
 * The GATT UUIDs are mirrored by hand with only a comment to hold them together, and that is
 * survivable because a wrong UUID fails loudly and immediately, on the first connection. This does
 * not. So it is asserted, and this test is the reason the comment in `notices.ts` can promise it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MODE_NOTICE, NOTICES } from './notices';

/** The board's catalogue, read as text: jest cannot import Python, and does not need to. */
const boardModule = readFileSync(
  join(__dirname, '../../../../hardware/raspi/virovision/notices.py'),
  'utf8'
);

function clipsOnTheBoard(): Set<string> {
  // The recorded notices are the keys of the `NOTICES` dict; the chirp is `EARCON_FILE`, apart
  // because it is synthesized rather than spoken.
  const recorded = [...boardModule.matchAll(/^\s{4}"([a-z0-9_]+\.wav)":/gm)].map((m) => m[1]);
  const earcon = boardModule.match(/^EARCON_FILE = "([a-z0-9_]+\.wav)"/m);
  expect(earcon).not.toBeNull();
  return new Set([...recorded, earcon![1]]);
}

describe('the notice catalogue', () => {
  it('names only clips the board actually has', () => {
    const board = clipsOnTheBoard();
    // Sanity on the parse itself: an empty set would make every assertion below vacuous.
    expect(board.size).toBeGreaterThan(5);

    const missing = Object.entries(NOTICES)
      .filter(([, notice]) => notice.clip !== null && !board.has(notice.clip))
      .map(([id, notice]) => `${id} -> ${notice.clip}`);
    expect(missing).toEqual([]);
  });

  it('leaves no clip on the board that nothing can ask for', () => {
    // The other direction, and it is not symmetry for its own sake: a clip nobody asks for is a
    // notice someone recorded and then forgot to route, which is the same bug seen from the other
    // end — the board can say it and never does.
    const asked = new Set<string>(
      Object.values(NOTICES).flatMap((notice) => (notice.clip === null ? [] : [notice.clip]))
    );
    expect([...clipsOnTheBoard()].filter((clip) => !asked.has(clip))).toEqual([]);
  });

  it('gives every notice something to say, in one place or the other', () => {
    // A notice with no clip AND no sentence is silence with an id: it would look routed and be
    // heard nowhere. The chirp is the one allowed to have no sentence, because it is a sound.
    for (const [id, notice] of Object.entries(NOTICES)) {
      expect(notice.clip === null && notice.say === null).toBe(false);
      if (notice.say === null) expect(id).toBe('readingStarted');
    }
  });

  it('keeps anything that reports a board failure off the board', () => {
    // A notice about the board being in trouble must not be delivered BY the board: whatever is
    // wrong may be the very thing that would carry it, and when what is wrong is the notice channel
    // itself the two halves feed each other forever. Written as a rule and not as one assertion so
    // that a notice added later for the same kind of event has to face it.
    for (const id of ['deviceWarning', 'connectionLost'] as const) {
      expect(NOTICES[id].clip).toBeNull();
    }
  });

  it('covers every mode', () => {
    // The mode announcement is the one notice chosen by a lookup rather than by name, so a mode
    // added without its notice would throw at the moment of the transition — on the user's ear.
    expect(Object.keys(MODE_NOTICE).sort()).toEqual(['bus', 'idle', 'supermarket']);
    for (const id of Object.values(MODE_NOTICE)) expect(NOTICES[id]).toBeDefined();
  });
});
