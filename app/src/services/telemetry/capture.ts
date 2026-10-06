/**
 * The two places an error or a log goes when nobody records it by hand: the console and an
 * unhandled promise rejection. Both are captured into telemetry and **neither reaches the user**
 * (2026-10-06: the app never shows an error; the table is where they are read).
 *
 * Kept out of `recorder.ts` so it can be tested with a fake console and a fake engine, and so the
 * recorder keeps a single job: queue and upload.
 */
import { errorDetail } from './errorDetail';

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

const LEVELS: readonly LogLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

/**
 * How many console rows one session may produce. A library that logs on every frame would otherwise
 * push the 500-event queue past its cap and evict the rows that matter — the reading, the crash.
 * Errors and warnings are worth more than chatter, so they get their own, larger budget.
 */
export const CONSOLE_BUDGET = { chatter: 50, problems: 200 } as const;

/** An error as a telemetry detail: name, capped message and capped stack. */
export function describeError(error: unknown): Record<string, unknown> {
  const err = error as { name?: unknown; stack?: unknown } | null | undefined;
  return {
    name: typeof err?.name === 'string' ? err.name : null,
    message: errorDetail(error),
    // The stack trimmed: with an 8 KB cap for ALL of the detail, a whole one takes the event with it.
    stack: typeof err?.stack === 'string' ? err.stack.slice(0, 2_000) : null,
  };
}

function format(args: unknown[]): string {
  return args.map((a) => (typeof a === 'string' ? a : errorDetail(a))).join(' ').slice(0, 1_000);
}

/**
 * Wraps `console.*` so every call is also recorded. The original still runs: in development the
 * Metro terminal keeps working, and in a release build it goes nowhere visible anyway.
 *
 * Re-entrancy guarded: if `record` itself ever logged, the wrapper would call itself forever.
 */
export function captureConsole(
  target: Pick<Console, LogLevel>,
  onLog: (level: LogLevel, message: string) => void
): () => void {
  const originals = new Map<LogLevel, (...args: unknown[]) => void>();
  const used = { chatter: 0, problems: 0 };
  let inside = false;

  for (const level of LEVELS) {
    const original = target[level] as (...args: unknown[]) => void;
    originals.set(level, original);
    target[level] = (...args: unknown[]) => {
      if (!inside) {
        inside = true;
        try {
          const bucket = level === 'warn' || level === 'error' ? 'problems' : 'chatter';
          if (used[bucket] < CONSOLE_BUDGET[bucket]) {
            used[bucket] += 1;
            onLog(level, format(args));
          }
        } catch {
          // Telemetry never takes anything down, least of all a console call.
        } finally {
          inside = false;
        }
      }
      original.apply(target, args);
    };
  }

  return () => {
    for (const [level, original] of originals) target[level] = original;
  };
}

interface RejectionTrackerOptions {
  allRejections: boolean;
  onUnhandled: (id: number, error: unknown) => void;
  onHandled: (id: number) => void;
}

interface PromiseEngine {
  enablePromiseRejectionTracker?: (options: RejectionTrackerOptions) => void;
}

/**
 * Records every promise rejection nobody handled.
 *
 * React Native only tracks them in development (to show the yellow box), so in a release build a
 * rejected `void foo()` vanishes without a trace — and the BLE callbacks are full of those. Hermes
 * exposes the tracker directly; with no Hermes (the jest runtime) this does nothing.
 *
 * It cannot be uninstalled — Hermes has no "disable" — so the returned function only stops the
 * recording.
 */
export function captureRejections(
  onUnhandled: (error: unknown) => void,
  // Release builds only by default: in development React Native installs its own tracker to show
  // the warning, and replacing it would hide unhandled rejections from whoever is writing the code.
  engine: PromiseEngine | undefined = __DEV__ ? undefined : (globalThis as { HermesInternal?: PromiseEngine }).HermesInternal
): () => void {
  let active = true;
  try {
    engine?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, error) => {
        if (!active) return;
        try {
          onUnhandled(error);
        } catch {
          // Same rule as the console: telemetry takes nothing down.
        }
      },
      onHandled: () => {},
    });
  } catch {
    // An engine that refuses the tracker leaves rejections untracked, which is where we started.
  }
  return () => {
    active = false;
  };
}
