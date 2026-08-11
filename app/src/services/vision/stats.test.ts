import { formatBytes, formatMs, median, percentile, summarize } from './stats';
import type { BenchmarkResult, LatencyMs } from './types';

function runWith(ms: Partial<LatencyMs>): BenchmarkResult {
  return {
    marks: { requestSentAt: 0 },
    ms: {
      toHeaders: NaN,
      toFirstByte: NaN,
      toFirstEvent: NaN,
      toFirstTextBlock: NaN,
      toFirstTextDelta: NaN,
      total: NaN,
      ...ms,
    },
    eventCounts: {},
    usage: null,
    stopReason: null,
    text: '',
    parsed: null,
    imageBase64Bytes: 0,
    model: 'claude-opus-5',
    thinking: 'off',
    effort: 'low',
    startedAtEpoch: 0,
  };
}

describe('percentile', () => {
  it('calcula la mediana de un conjunto impar', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('interpola la mediana de un conjunto par', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('calcula el p90 interpolando', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
  });

  it('ignora los valores no finitos', () => {
    expect(median([NaN, 10, 20, NaN, 30])).toBe(20);
  });

  it('devuelve NaN sin muestras', () => {
    expect(median([])).toBeNaN();
    expect(median([NaN])).toBeNaN();
  });

  it('devuelve el único valor cuando hay una sola muestra', () => {
    expect(percentile([42], 0.9)).toBe(42);
  });
});

describe('summarize', () => {
  it('resume una métrica a lo largo de varias corridas', () => {
    const runs = [
      runWith({ toFirstTextDelta: 900 }),
      runWith({ toFirstTextDelta: 1100 }),
      runWith({ toFirstTextDelta: 1000 }),
    ];

    const summary = summarize(runs, 'toFirstTextDelta');

    expect(summary.samples).toBe(3);
    expect(summary.medianMs).toBe(1000);
    expect(summary.minMs).toBe(900);
    expect(summary.maxMs).toBe(1100);
  });

  it('descarta las corridas que no alcanzaron la métrica', () => {
    const runs = [runWith({ toFirstTextDelta: 800 }), runWith({}), runWith({ total: 5000 })];

    const summary = summarize(runs, 'toFirstTextDelta');

    expect(summary.samples).toBe(1);
    expect(summary.medianMs).toBe(800);
  });

  it('devuelve NaN cuando ninguna corrida aportó la métrica', () => {
    const summary = summarize([runWith({})], 'toFirstTextDelta');

    expect(summary.samples).toBe(0);
    expect(summary.medianMs).toBeNaN();
    expect(summary.minMs).toBeNaN();
  });
});

describe('formatMs', () => {
  it('muestra milisegundos redondeados por debajo del segundo', () => {
    expect(formatMs(842.4)).toBe('842 ms');
  });

  it('pasa a segundos a partir de 1000 ms', () => {
    expect(formatMs(2530)).toBe('2.53 s');
  });

  it('muestra un guion cuando la marca no se alcanzó', () => {
    expect(formatMs(NaN)).toBe('—');
  });
});

describe('formatBytes', () => {
  it('muestra kilobytes por debajo del megabyte', () => {
    expect(formatBytes(200 * 1024)).toBe('200 kB');
  });

  it('muestra megabytes con dos decimales', () => {
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });

  it('muestra un guion sin datos', () => {
    expect(formatBytes(0)).toBe('—');
  });
});
