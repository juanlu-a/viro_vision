import { createGallery } from './gallery';

const RUN = '20261013-150231';

describe('gallery', () => {
  it('puts the bus frame, every read and the decision under one bus', () => {
    const g = createGallery();
    g.add({ ref: `${RUN}/t003-bus`, what: 'bus', track: 3, wall: '2026-10-13 15:02:31.120' }, { 't003-bus.jpg': 'file:///b.jpg' });
    g.add(
      { ref: `${RUN}/t003-r02`, what: 'read', track: 3, attempt: 2, texts: [{ text: '115', score: 0.9 }, { text: 'LUIS BRAILLE', score: 0.8 }], number: '115', destination: 'Luis Braille' },
      { 't003-r02-crop.jpg': 'file:///c2.jpg', 't003-r02-frame.jpg': 'file:///f2.jpg' },
    );
    g.add({ ref: `${RUN}/t003-r01`, what: 'read', track: 3, attempt: 1, texts: [] }, { 't003-r01-crop.jpg': 'file:///c1.jpg' });
    g.add({ ref: `${RUN}/t003-decided`, what: 'decided', track: 3, number: '115', destination: 'Luis Braille', announced: true }, {});

    const [shot] = g.get();
    expect(g.get()).toHaveLength(1);
    expect(shot).toMatchObject({ key: `${RUN}/t003`, track: 3, time: '15:02:31', busUri: 'file:///b.jpg' });
    expect(shot.reads.map((r) => r.attempt)).toEqual([1, 2]);
    expect(shot.reads[0]).toMatchObject({ cropUri: 'file:///c1.jpg', frameUri: null, text: '' });
    expect(shot.reads[1]).toMatchObject({ cropUri: 'file:///c2.jpg', frameUri: 'file:///f2.jpg', text: '115 LUIS BRAILLE', number: '115' });
    expect(shot.decided).toEqual({ number: '115', destination: 'Luis Braille', announced: true });
  });

  it('shows the newest bus first, and a bus keeps its place when its reads arrive later', () => {
    const g = createGallery();
    g.add({ ref: `${RUN}/t001-bus`, what: 'bus', track: 1 }, {});
    g.add({ ref: `${RUN}/t002-bus`, what: 'bus', track: 2 }, {});
    g.add({ ref: `${RUN}/t001-r01`, what: 'read', track: 1, attempt: 1 }, {});
    expect(g.get().map((s) => s.track)).toEqual([2, 1]);
  });

  it('evicts the oldest bus past the limit and hands back its files', () => {
    const evicted: string[][] = [];
    const g = createGallery({ max: 2, onEvict: (uris) => evicted.push(uris) });
    g.add({ ref: `${RUN}/t001-bus`, what: 'bus', track: 1 }, { 't001-bus.jpg': 'file:///1.jpg' });
    g.add({ ref: `${RUN}/t001-r01`, what: 'read', track: 1, attempt: 1 }, { 't001-r01-crop.jpg': 'file:///1c.jpg' });
    g.add({ ref: `${RUN}/t002-bus`, what: 'bus', track: 2 }, {});
    g.add({ ref: `${RUN}/t003-bus`, what: 'bus', track: 3 }, {});
    expect(g.get().map((s) => s.track)).toEqual([3, 2]);
    expect(evicted).toEqual([['file:///1.jpg', 'file:///1c.jpg']]);
  });

  it('tells its subscribers, and ignores what it cannot place', () => {
    const g = createGallery();
    const listener = jest.fn();
    const off = g.subscribe(listener);
    g.add({ ref: 'nonsense', what: 'bus' }, {});
    g.add({ ref: `${RUN}/t001-bus`, what: 'bus', track: 1 }, {});
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    g.add({ ref: `${RUN}/t002-bus`, what: 'bus', track: 2 }, {});
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
