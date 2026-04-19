import { OccurrenceCounter } from '@axhxrx/utf8-count';
import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import process from 'node:process';

import type { CommandResult } from './types/CommandResult.ts';

export interface RunCommandOptions
{
  /**
   Substring patterns to count in the child's stdout/stderr. The two returned counters are both registered with the same pattern list; the caller decides which counter(s) to query.
   */
  patterns: readonly string[];

  /**
   `'inherit'` pipes the child's output directly to the parent's stdout/stderr (default). `'stderr'` routes the child's stdout to the parent's stderr too, so stdout stays clean for a JSON result. `'none'` suppresses all output.

   In every mode the counters still see the data.
   */
  echoOutputMode?: 'inherit' | 'stderr' | 'none';
}

function signalExitCode(signal: string): number
{
  const n = osConstants.signals[signal as NodeJS.Signals];
  return n ? 128 + n : 1;
}

/**
 Spawn a shell command and stream its output to the parent process while feeding stdout and stderr into two independent `OccurrenceCounter`s.

 The command is executed via the system shell (`/bin/sh -c` on POSIX, `cmd.exe` on Windows), so shell features like `&&`, pipes, and `$VAR` work inside the command string.
 */
export function runCommand(
  command: string,
  options: RunCommandOptions,
): Promise<CommandResult>
{
  const echo = options.echoOutputMode ?? 'inherit';
  const stdoutCounter = new OccurrenceCounter(options.patterns);
  const stderrCounter = new OccurrenceCounter(options.patterns);

  return new Promise((resolve, reject) =>
  {
    const start = performance.now();

    const child = spawn(command, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const stdout = child.stdout;
    const stderr = child.stderr;
    if (!stdout || !stderr)
    {
      reject(new Error('[retry-command] child process has no piped stdout/stderr'));
      return;
    }

    stdout.on('data', (chunk: Uint8Array) =>
    {
      stdoutCounter.appendBytes(chunk);
      if (echo === 'inherit')
      {
        process.stdout.write(chunk);
      }
      else if (echo === 'stderr')
      {
        process.stderr.write(chunk);
      }
    });

    stderr.on('data', (chunk: Uint8Array) =>
    {
      stderrCounter.appendBytes(chunk);
      if (echo !== 'none')
      {
        process.stderr.write(chunk);
      }
    });

    child.on('error', (error) =>
    {
      reject(error);
    });

    child.on('close', (code, signal) =>
    {
      stdoutCounter.end();
      stderrCounter.end();
      resolve({
        exitCode: code ?? (signal ? signalExitCode(signal) : 1),
        signal: signal ?? null,
        attempt: 0,
        durationMs: Math.round(performance.now() - start),
        stdoutCounter,
        stderrCounter,
      });
    });
  });
}
