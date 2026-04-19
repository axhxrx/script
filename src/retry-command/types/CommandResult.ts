import type { OccurrenceCounter } from '@axhxrx/utf8-count';

/**
 The outcome of a single attempt of the child command.
 */
export interface CommandResult
{
  /**
   Numeric exit code. If the process was terminated by a signal, this is `128 + signal-number` (matching the convention used by POSIX shells).
   */
  exitCode: number;

  /**
   The POSIX signal name that terminated the process, or `null` if the process exited normally.
   */
  signal: string | null;

  /**
   1-indexed attempt number this result corresponds to.
   */
  attempt: number;

  /**
   Wall-clock milliseconds the attempt took.
   */
  durationMs: number;

  /**
   Counter tracking `ifPatterns` / `unlessPatterns` occurrences across the child's stdout chunks for this attempt.
   */
  stdoutCounter: OccurrenceCounter;

  /**
   Counter tracking `ifPatterns` / `unlessPatterns` occurrences across the child's stderr chunks for this attempt.
   */
  stderrCounter: OccurrenceCounter;
}
