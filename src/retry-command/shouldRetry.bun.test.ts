import { OccurrenceCounter } from '@axhxrx/utf8-count';
import { describe, expect, test } from 'bun:test';

import { shouldRetry } from './shouldRetry.ts';
import type { CommandResult } from './types/CommandResult.ts';

function makeResult(
  stdout: string,
  stderr: string,
  patterns: readonly string[],
  exitCode = 1,
): CommandResult
{
  const stdoutCounter = new OccurrenceCounter(patterns);
  const stderrCounter = new OccurrenceCounter(patterns);
  stdoutCounter.appendString(stdout);
  stderrCounter.appendString(stderr);
  return {
    exitCode,
    signal: null,
    attempt: 1,
    durationMs: 10,
    stdoutCounter,
    stderrCounter,
  };
}

describe('shouldRetry', () =>
{
  test('retries unconditionally when no patterns are specified', () =>
  {
    const r = makeResult('some output', 'other output', []);
    expect(shouldRetry(r, {}).retry).toBe(true);
  });

  test('retries when --if pattern matches on stdout', () =>
  {
    const r = makeResult('ECONNRESET happened', '', ['ECONNRESET']);
    const d = shouldRetry(r, { ifPatterns: ['ECONNRESET'] });
    expect(d.retry).toBe(true);
  });

  test('retries when --if pattern matches on stderr (both selector)', () =>
  {
    const r = makeResult('', "Unhandled 'error' event", ["Unhandled 'error' event"]);
    const d = shouldRetry(r, { ifPatterns: ["Unhandled 'error' event"] });
    expect(d.retry).toBe(true);
  });

  test('skips when --if patterns are set but none match', () =>
  {
    const r = makeResult('boring output', 'boring stderr', ['ECONNRESET']);
    const d = shouldRetry(r, { ifPatterns: ['ECONNRESET'] });
    expect(d.retry).toBe(false);
    expect(d.skipReason).toContain('no allowlist');
  });

  test('--unless short-circuits even when --if would match', () =>
  {
    const patterns = ['ECONNRESET', 'compilation failed'];
    const r = makeResult('ECONNRESET... compilation failed', '', patterns);
    const d = shouldRetry(r, {
      ifPatterns: ['ECONNRESET'],
      unlessPatterns: ['compilation failed'],
    });
    expect(d.retry).toBe(false);
    expect(d.skipReason).toContain('--unless');
  });

  test('--stdout-only ignores stderr matches', () =>
  {
    const r = makeResult('', 'ECONNRESET on stderr', ['ECONNRESET']);
    const d = shouldRetry(r, { ifPatterns: ['ECONNRESET'], streamSelector: 'stdout' });
    expect(d.retry).toBe(false);
  });

  test('--stderr-only ignores stdout matches', () =>
  {
    const r = makeResult('ECONNRESET on stdout', '', ['ECONNRESET']);
    const d = shouldRetry(r, { ifPatterns: ['ECONNRESET'], streamSelector: 'stderr' });
    expect(d.retry).toBe(false);
  });

  test('--stderr-only still picks up stderr matches', () =>
  {
    const r = makeResult('', 'ECONNRESET on stderr', ['ECONNRESET']);
    const d = shouldRetry(r, { ifPatterns: ['ECONNRESET'], streamSelector: 'stderr' });
    expect(d.retry).toBe(true);
  });

  test('--unless with --stdout-only ignores an unless-match on stderr', () =>
  {
    const patterns = ['compilation failed'];
    const r = makeResult('', 'compilation failed', patterns);
    const d = shouldRetry(r, {
      unlessPatterns: ['compilation failed'],
      streamSelector: 'stdout',
    });
    expect(d.retry).toBe(true);
  });

  test('--if-exit-code retries when exit code is in the allowlist', () =>
  {
    const r = makeResult('', '', [], 28);
    const d = shouldRetry(r, { retryExitCodes: [7, 28] });
    expect(d.retry).toBe(true);
  });

  test('--if-exit-code skips when exit code is NOT in the allowlist', () =>
  {
    const r = makeResult('', '', [], 22);
    const d = shouldRetry(r, { retryExitCodes: [7, 28] });
    expect(d.retry).toBe(false);
    expect(d.skipReason).toContain('no allowlist');
  });

  test('--unless-exit-code short-circuits even when --if would match', () =>
  {
    const r = makeResult('ECONNRESET now', '', ['ECONNRESET'], 143);
    const d = shouldRetry(r, {
      ifPatterns: ['ECONNRESET'],
      noRetryExitCodes: [143],
    });
    expect(d.retry).toBe(false);
    expect(d.skipReason).toContain('--unless-exit-code');
  });

  test('--unless-exit-code short-circuits even when --if-exit-code would match', () =>
  {
    const r = makeResult('', '', [], 28);
    const d = shouldRetry(r, {
      retryExitCodes: [28],
      noRetryExitCodes: [28],
    });
    expect(d.retry).toBe(false);
    expect(d.skipReason).toContain('--unless-exit-code');
  });

  test('allowlists OR together: --if-exit-code satisfied is enough when --if is not', () =>
  {
    const r = makeResult('boring output', '', ['ECONNRESET'], 28);
    const d = shouldRetry(r, {
      ifPatterns: ['ECONNRESET'],
      retryExitCodes: [28],
    });
    expect(d.retry).toBe(true);
  });

  test('allowlists OR together: --if satisfied is enough when --if-exit-code is not', () =>
  {
    const r = makeResult('ECONNRESET here', '', ['ECONNRESET'], 22);
    const d = shouldRetry(r, {
      ifPatterns: ['ECONNRESET'],
      retryExitCodes: [28],
    });
    expect(d.retry).toBe(true);
  });

  test('allowlists OR together: both empty of hits → skip', () =>
  {
    const r = makeResult('boring output', '', ['ECONNRESET'], 22);
    const d = shouldRetry(r, {
      ifPatterns: ['ECONNRESET'],
      retryExitCodes: [28],
    });
    expect(d.retry).toBe(false);
    expect(d.skipReason).toContain('no allowlist');
  });

  test('empty retryExitCodes array is treated as "not set"', () =>
  {
    const r = makeResult('', '', [], 99);
    const d = shouldRetry(r, { retryExitCodes: [] });
    expect(d.retry).toBe(true);
  });
});
