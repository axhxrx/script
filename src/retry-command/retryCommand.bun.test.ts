import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { retryCommand } from './retryCommand.ts';

/**
 Small helper: create a temp "counter" script that records how many times it has been invoked, and exits non-zero (printing a chosen message) until it has run `succeedOnAttempt` times. Used to drive retry scenarios without relying on timing or real flakiness.
 */
function makeCounterScript(opts: {
  succeedOnAttempt: number;
  message: string;
  messageStream: 'stdout' | 'stderr';
}): { command: string; cleanup: () => void }
{
  const dir = mkdtempSync(join(tmpdir(), 'retry-cmd-test-'));
  const counterFile = join(dir, 'count');
  const script = join(dir, 'run.sh');
  writeFileSync(counterFile, '0');

  const redirect = opts.messageStream === 'stderr' ? '1>&2' : '';
  const body = `#!/bin/sh
count=$(cat "${counterFile}")
count=$((count + 1))
printf %s "$count" > "${counterFile}"
if [ "$count" -ge ${opts.succeedOnAttempt} ]; then
  exit 0
fi
printf '%s\\n' '${opts.message.replace(/'/g, "'\\''")}' ${redirect}
exit 1
`;
  writeFileSync(script, body, { mode: 0o755 });

  return {
    command: `sh ${script}`,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('retryCommand', () =>
{
  async function captureIO(run: () => Promise<number>): Promise<{ code: number; output: string }>
  {
    const chunks: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;

    const capture = (...args: unknown[]) =>
    {
      chunks.push(args.map(a => typeof a === 'string' ? a : String(a)).join(' '));
    };
    console.log = capture;
    console.error = capture;

    try
    {
      const code = await run();
      return { code, output: chunks.join('\n') };
    }
    finally
    {
      console.log = originalLog;
      console.error = originalError;
    }
  }

  test('logs skip-retry decisions by default', async () =>
  {
    const { code, output } = await captureIO(() =>
      retryCommand('sh -c "echo boring failure 1>&2; exit 1"', {
        maxRetries: 1,
        delayMs: 0,
        ifPatterns: ['ECONNRESET'],
      })
    );
    expect(code).toBe(1);
    expect(output).toContain('Skipping retry');
  });

  test('--quiet suppresses retry-command execution chatter', async () =>
  {
    const { code, output } = await captureIO(() =>
      retryCommand('sh -c "echo boring failure 1>&2; exit 1"', {
        maxRetries: 1,
        delayMs: 0,
        ifPatterns: ['ECONNRESET'],
        quiet: true,
      })
    );
    expect(code).toBe(1);
    expect(output).not.toContain('[retry-command]');
    expect(output).not.toContain('Skipping retry');
  });

  test('returns 0 when the command succeeds on the first attempt', async () =>
  {
    const code = await retryCommand('true', { maxRetries: 2, delayMs: 0 });
    expect(code).toBe(0);
  });

  test('retries on failure and eventually succeeds', async () =>
  {
    const { command, cleanup } = makeCounterScript({
      succeedOnAttempt: 2,
      message: 'transient ECONNRESET',
      messageStream: 'stderr',
    });
    try
    {
      const code = await retryCommand(command, { maxRetries: 2, delayMs: 0 });
      expect(code).toBe(0);
    }
    finally
    {
      cleanup();
    }
  });

  test('gives up after exhausting retries', async () =>
  {
    const { command, cleanup } = makeCounterScript({
      succeedOnAttempt: 999,
      message: 'boring',
      messageStream: 'stderr',
    });
    try
    {
      const code = await retryCommand(command, { maxRetries: 1, delayMs: 0 });
      expect(code).not.toBe(0);
    }
    finally
    {
      cleanup();
    }
  });

  test('skips retry when --unless matches', async () =>
  {
    const { command, cleanup } = makeCounterScript({
      succeedOnAttempt: 999,
      message: 'compilation failed',
      messageStream: 'stderr',
    });
    try
    {
      const code = await retryCommand(command, {
        maxRetries: 5,
        delayMs: 0,
        unlessPatterns: ['compilation failed'],
      });
      expect(code).not.toBe(0);
    }
    finally
    {
      cleanup();
    }
  });

  test('skips retry when --if patterns are set but none match', async () =>
  {
    const { command, cleanup } = makeCounterScript({
      succeedOnAttempt: 999,
      message: 'just a boring failure',
      messageStream: 'stderr',
    });
    try
    {
      const code = await retryCommand(command, {
        maxRetries: 5,
        delayMs: 0,
        ifPatterns: ['ECONNRESET'],
      });
      expect(code).not.toBe(0);
    }
    finally
    {
      cleanup();
    }
  });

  test('retries only when --if matches on the selected stream', async () =>
  {
    // Message goes to stdout, but we restrict pattern scanning to stderr.
    // Despite the pattern string appearing in stdout, we should NOT retry.
    const { command, cleanup } = makeCounterScript({
      succeedOnAttempt: 2,
      message: 'ECONNRESET',
      messageStream: 'stdout',
    });
    try
    {
      const code = await retryCommand(command, {
        maxRetries: 3,
        delayMs: 0,
        ifPatterns: ['ECONNRESET'],
        streamSelector: 'stderr',
      });
      expect(code).not.toBe(0);
    }
    finally
    {
      cleanup();
    }
  });

  test('rejects empty command string', async () =>
  {
    const code = await retryCommand('   ', {});
    expect(code).toBe(1);
  });

  test('rejects negative maxRetries', async () =>
  {
    const code = await retryCommand('true', { maxRetries: -1 });
    expect(code).toBe(1);
  });

  test('rejects non-integer maxRetries', async () =>
  {
    const code = await retryCommand('true', { maxRetries: 1.5 });
    expect(code).toBe(1);
  });

  test('rejects NaN maxRetries', async () =>
  {
    const code = await retryCommand('true', { maxRetries: Number.NaN });
    expect(code).toBe(1);
  });

  test('rejects negative delayMs', async () =>
  {
    const code = await retryCommand('true', { delayMs: -1 });
    expect(code).toBe(1);
  });

  test('rejects non-integer delayMs', async () =>
  {
    const code = await retryCommand('true', { delayMs: 1.5 });
    expect(code).toBe(1);
  });

  test('shell features work inside the command string', async () =>
  {
    // `true && true` requires the shell to parse && — proves shell mode.
    const code = await retryCommand('true && true', { maxRetries: 0, delayMs: 0 });
    expect(code).toBe(0);
  });
});
