/**
 * Exists because these two hooks are the only way an error nobody recorded by hand reaches the
 * table (2026-10-06, when the app stopped showing errors at all). If the console wrapper swallowed
 * the original call, development would lose its logs; if it recursed, the app would hang; if it had
 * no budget, a chatty library would evict the rows that matter from the 500-event queue.
 */
import { CONSOLE_BUDGET, captureConsole, captureRejections, describeError } from './capture';

function fakeConsole() {
  const calls: string[] = [];
  const make = (level: string) => (...args: unknown[]) => void calls.push(`${level}:${args.join(' ')}`);
  return {
    calls,
    target: { log: make('log'), info: make('info'), warn: make('warn'), error: make('error'), debug: make('debug') },
  };
}

describe('captureConsole', () => {
  it('records the call and still runs the original', () => {
    const { calls, target } = fakeConsole();
    const rows: string[] = [];
    captureConsole(target, (level, message) => rows.push(`${level}:${message}`));

    target.error('boom', new Error('detail'));

    expect(rows).toEqual(['error:boom detail']);
    expect(calls).toHaveLength(1);
  });

  it('does not recurse when recording logs too', () => {
    const { target } = fakeConsole();
    let count = 0;
    captureConsole(target, () => {
      count += 1;
      target.warn('from inside the recorder');
    });

    target.log('outer');

    expect(count).toBe(1);
  });

  it('stops recording chatter past its budget but keeps recording problems', () => {
    const { target } = fakeConsole();
    const levels: string[] = [];
    captureConsole(target, (level) => levels.push(level));

    for (let i = 0; i < CONSOLE_BUDGET.chatter + 10; i++) target.log('tick');
    target.error('still counts');

    expect(levels.filter((l) => l === 'log')).toHaveLength(CONSOLE_BUDGET.chatter);
    expect(levels).toContain('error');
  });

  it('restores the console when uninstalled', () => {
    const { target } = fakeConsole();
    const original = target.warn;
    const uninstall = captureConsole(target, () => {});
    expect(target.warn).not.toBe(original);
    uninstall();
    expect(target.warn).toBe(original);
  });
});

describe('captureRejections', () => {
  it('hands every unhandled rejection to the recorder until stopped', () => {
    let tracker: { onUnhandled: (id: number, error: unknown) => void } | null = null;
    const errors: unknown[] = [];
    const stop = captureRejections((e) => errors.push(e), {
      enablePromiseRejectionTracker: (options) => {
        tracker = options;
      },
    });

    tracker!.onUnhandled(1, new Error('lost'));
    stop();
    tracker!.onUnhandled(2, new Error('after stop'));

    expect(errors).toHaveLength(1);
  });

  it('does nothing without an engine that supports it', () => {
    expect(() => captureRejections(() => {}, undefined)()).not.toThrow();
  });
});

describe('describeError', () => {
  it('keeps the name, the message and a capped stack', () => {
    const err = new TypeError('bad');
    err.stack = 'x'.repeat(5_000);
    const detail = describeError(err);
    expect(detail.name).toBe('TypeError');
    expect(detail.message).toBe('bad');
    expect(String(detail.stack)).toHaveLength(2_000);
  });

  it('copes with a thrown non-error', () => {
    expect(describeError('plain')).toEqual({ name: null, message: 'plain', stack: null });
  });
});
