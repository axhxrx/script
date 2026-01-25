/* eslint-disable no-console */

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { format } from 'node:util';

import { defaultOutputContext } from './OutputContext.ts';
import type { OutputContext } from './OutputContext.ts';
import type { Step } from './Step.ts';
import type { StepResult, StepStatus, StepType } from './StepResult.ts';

/**
 Options for running a step.
 */
export interface RunStepOptions
{
  /**
   Capture stdout/stderr from command steps. When true (default), output is both streamed to the terminal and captured in the result.
   */
  captureOutput?: boolean;

  /**
   Output context for routing output to terminal and/or file.
   */
  outputContext?: OutputContext;
}

/**
 Check if we're on a Unix-like platform (macOS, Linux, etc.)
 */
const isUnix = process.platform !== 'win32';

/**
 Create a unique temp file path for capturing output.
 */
function createTempPath(prefix: string): string
{
  return join(tmpdir(), `${prefix}-${randomUUID()}.log`);
}

/**
 Run a command using Unix `tee` to stream output to terminal AND capture to temp files.

 This is the preferred approach on Unix, but doesn't work on Windows, so we use a different approach (runCommandWithCapture) there.
 */
async function runCommandWithTee(
  command: string,
  options: { cwd?: string; env?: Record<string, string> },
): Promise<{ exitCode: number; stdout: string; stderr: string }>
{
  const { writeFile } = await import('node:fs/promises');

  const stdoutFile = createTempPath('script-stdout');
  const stderrFile = createTempPath('script-stderr');

  // Pre-create files to ensure they exist before tee tries to write
  await writeFile(stdoutFile, '');
  await writeFile(stderrFile, '');

  // Use exec to redirect stdout/stderr to tee processes that write to files.
  // The `wait` ensures tee processes complete before bash exits.
  // Exit code is captured before wait (which returns 0).
  const wrappedCmd = `
exec > >(tee "${stdoutFile}") 2> >(tee "${stderrFile}" >&2)
${command}
__exit=$?
wait
exit $__exit
`.trim();

  return new Promise((resolve, reject) =>
  {
    const child = spawn('bash', ['-c', wrappedCmd], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'inherit', // Pass through to terminal
    });

    child.on('close', async (code) =>
    {
      try
      {
        // Small delay to ensure tee has flushed to disk
        await new Promise((r) => setTimeout(r, 10));

        // Read captured output from temp files
        const stdout = await readFile(stdoutFile, 'utf-8').catch(() => '');
        const stderr = await readFile(stderrFile, 'utf-8').catch(() => '');

        // Clean up temp files (ignore errors if already deleted)
        await unlink(stdoutFile).catch(() =>
        {});
        await unlink(stderrFile).catch(() =>
        {});

        resolve({ exitCode: code ?? 0, stdout, stderr });
      }
      catch (err)
      {
        reject(err);
      }
    });

    child.on('error', reject);
  });
}

/**
 Run a command using spawn with real-time streaming and output capture.

 This is the fallback implementation for Windows, where `tee` is not available. It use TextDecoder with streaming mode to handle UTF-8 multi-byte sequences that may span chunk boundaries.
 */
function runCommandWithCapture(
  command: string,
  options: { cwd?: string; env?: Record<string, string>; ctx?: OutputContext },
): Promise<{ exitCode: number; stdout: string; stderr: string }>
{
  const ctx = options.ctx ?? defaultOutputContext;

  return new Promise((resolve, reject) =>
  {
    const child = spawn(command, {
      shell: true,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    const stdoutDecoder = new TextDecoder('utf-8', { fatal: false });
    const stderrDecoder = new TextDecoder('utf-8', { fatal: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Uint8Array) =>
    {
      const text = stdoutDecoder.decode(data, { stream: true });
      ctx.stdout(text); // Stream to terminal and file
      stdout += text; // Capture
    });

    child.stderr.on('data', (data: Uint8Array) =>
    {
      const text = stderrDecoder.decode(data, { stream: true });
      ctx.stderr(text); // Stream to terminal and file
      stderr += text; // Capture
    });

    child.on('close', (code) =>
    {
      // Flush any remaining bytes in the decoders
      stdout += stdoutDecoder.decode(new Uint8Array(0));
      stderr += stderrDecoder.decode(new Uint8Array(0));
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

    child.on('error', reject);
  });
}

/**
 Run a single shell command (internal helper for runStep).
 */
async function runSingleCommand(
  command: string,
  stepOptions: Step['options'],
  captureOutput: boolean,
  ctx: OutputContext,
): Promise<{ exitCode: number; stdout?: string; stderr?: string }>
{
  if (stepOptions.interactive)
  {
    // Use spawnSync for interactive commands (browser auth flows, etc.)
    // Cannot capture output because stdio: 'inherit' hands terminal to child
    const result = spawnSync(command, {
      stdio: 'inherit',
      cwd: stepOptions.cwd,
      shell: true,
      env: { ...process.env, ...stepOptions.env },
    });

    return { exitCode: result.status ?? 0 };
  }
  else if (captureOutput)
  {
    // Use platform-specific capture: tee on Unix, TextDecoder fallback on Windows
    // Note: tee uses stdio:'inherit' so can't use ctx there, but Windows path does
    if (isUnix)
    {
      return await runCommandWithTee(command, {
        cwd: stepOptions.cwd,
        env: stepOptions.env,
      });
    }
    else
    {
      return await runCommandWithCapture(command, {
        cwd: stepOptions.cwd,
        env: stepOptions.env,
        ctx,
      });
    }
  }
  else
  {
    // No capture - use spawnSync with inherit (original behavior)
    const result = spawnSync(command, {
      stdio: 'inherit',
      cwd: stepOptions.cwd,
      shell: true,
      env: { ...process.env, ...stepOptions.env },
    });

    return { exitCode: result.status ?? 0 };
  }
}

/**
 Get the description for a step.
 */
export function getStepDescription(step: Step): string
{
  if (step.options.description)
  {
    return step.options.description;
  }

  if (step.commands.length === 0)
  {
    return '[empty step]';
  }

  const first = step.commands[0];
  if (typeof first === 'string')
  {
    return step.commands.length === 1
      ? first
      : `[${step.commands.length} commands]`;
  }
  const text = typeof first === 'function'
    ? first.name || first.toString()
    : '[function step]';

  const MAX_LENGTH = 80;
  const suffixToAdd = text.length > MAX_LENGTH ? '...' : '';
  const result = text.substring(0, MAX_LENGTH).replaceAll('  ', ' ').replaceAll('\n', '↩︎ ') + suffixToAdd;
  return result;
}

/**
 Check if a step contains only functions (no shell commands).
 */
export function isFunctionStep(step: Step): boolean
{
  return (
    step.commands.length > 0
    && step.commands.every((cmd) => typeof cmd === 'function')
  );
}

/**
 Run a single step (mixed commands array of shell commands and functions) and return a StepResult.

 @param step - The step to run
 @param index - The index of this step in the script (0-based)
 @param options - Options for running the step
 @returns StepResult with timing, status, and optionally captured output
 */
export async function runStep(
  step: Step,
  index: number,
  options: RunStepOptions = {},
): Promise<StepResult>
{
  const { commands, options: stepOptions } = step;
  const ctx = options.outputContext ?? defaultOutputContext;

  // Build description
  const desc = getStepDescription(step);

  // Force output capture if file logging is enabled (otherwise stdio:inherit bypasses file logging)
  const captureOutput = (options.captureOutput ?? true) || ctx.filePath !== undefined;

  // Determine step type
  const type: StepType = isFunctionStep(step)
    ? 'function'
    : stepOptions.interactive
    ? 'interactive'
    : 'command';

  ctx.log(`\n🚀 ${desc}\n`);

  // Show individual commands if we have a description
  if (stepOptions.description && commands.length > 0)
  {
    for (const cmd of commands)
    {
      if (typeof cmd === 'string')
      {
        ctx.log(`  $ ${cmd}`);
      }
      else
      {
        ctx.log(`  [function]`);
      }
    }
  }

  const startedAt = new Date();
  let status: StepStatus = 'success';
  let exitCode: number | undefined;
  let stdout: string | undefined;
  let stderr: string | undefined;
  let error: Error | undefined;

  // Collect string commands for result
  const commandStrings = commands.filter(
    (c): c is string => typeof c === 'string',
  );

  try
  {
    // Run commands sequentially - mixed array of strings and functions
    let combinedStdout = '';
    let combinedStderr = '';

    for (const cmd of commands)
    {
      if (typeof cmd === 'string')
      {
        // Shell command
        const result = await runSingleCommand(cmd, stepOptions, captureOutput, ctx);
        exitCode = result.exitCode;

        if (result.stdout) combinedStdout += result.stdout;
        if (result.stderr) combinedStderr += result.stderr;

        // On Unix, runCommandWithTee uses stdio:inherit for terminal output, so captured
        // output wasn't written to the ctx file. Write it now using file-only methods.
        if (isUnix && captureOutput && ctx.filePath)
        {
          if (result.stdout) ctx.fileStdout(result.stdout);
          if (result.stderr) ctx.fileStderr(result.stderr);
        }

        // Update stdout/stderr after each command so they're available if we throw
        stdout = combinedStdout || undefined;
        stderr = combinedStderr || undefined;

        if (result.exitCode !== 0 && stepOptions.onError !== 'continue')
        {
          if (stepOptions.onError === 'warn')
          {
            ctx.warn(
              `⚠️  Command failed with exit code ${result.exitCode}: ${cmd}`,
            );
            status = 'warning';
            // Continue to next command in warn mode
          }
          else
          {
            // Default: fail mode - throw and stop
            throw new Error(
              `Command failed with exit code ${result.exitCode}: ${cmd}`,
            );
          }
        }
      }
      else
      {
        // Function - execute it with console interception for file logging
        let fnResult: void | boolean | number;

        // If we have file logging, intercept console.log/warn/error during function execution
        if (ctx.filePath)
        {
          const originalLog = console.log;
          const originalWarn = console.warn;
          const originalError = console.error;

          console.log = (...args: unknown[]) =>
          {
            const text = format(...args) + '\n';
            ctx.stdout(text);
          };
          console.warn = (...args: unknown[]) =>
          {
            const text = format(...args) + '\n';
            ctx.stderr(text);
          };
          console.error = (...args: unknown[]) =>
          {
            const text = format(...args) + '\n';
            ctx.stderr(text);
          };

          try
          {
            fnResult = await cmd();
          }
          finally
          {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
          }
        }
        else
        {
          fnResult = await cmd();
        }

        // Handle return value: void/undefined = success, true = success, false = failure,
        // 0 = success, non-zero number = failure
        if (fnResult === false)
        {
          exitCode = 1;
          if (stepOptions.onError !== 'continue')
          {
            if (stepOptions.onError === 'warn')
            {
              ctx.warn(`⚠️  Function returned false`);
              status = 'warning';
            }
            else
            {
              throw new Error('Function returned false');
            }
          }
        }
        else if (typeof fnResult === 'number' && fnResult !== 0)
        {
          exitCode = fnResult;
          if (stepOptions.onError !== 'continue')
          {
            if (stepOptions.onError === 'warn')
            {
              ctx.warn(
                `⚠️  Function returned non-zero exit code: ${fnResult}`,
              );
              status = 'warning';
            }
            else
            {
              throw new Error(
                `Function returned non-zero exit code: ${fnResult}`,
              );
            }
          }
        }
      }
    }

    ctx.log('');
  }
  catch (err: unknown)
  {
    error = err instanceof Error ? err : new Error(String(err));

    if (stepOptions.onError === 'warn')
    {
      ctx.warn(`⚠️  Warning: ${error.message}\n`);
      status = 'warning';
    }
    else if (stepOptions.onError === 'continue')
    {
      ctx.log('✓ Continued (error ignored)\n');
      status = 'success'; // Treat as success since we're continuing
    }
    else
    {
      status = 'error';
      // Re-throw after building result so caller can catch
    }
  }

  const finishedAt = new Date();

  const result: StepResult = {
    index,
    type,
    description: desc,
    commands: commandStrings.length > 0 ? commandStrings : undefined,
    status,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    exitCode,
    stdout,
    stderr,
    error,
  };

  // If there was an unhandled error (not warn or continue), throw it
  // so the caller can handle it, but the result is still built
  if (status === 'error' && error)
  {
    // Attach result to error so caller can access it
    (error as Error & { stepResult?: StepResult }).stepResult = result;
    throw error;
  }

  return result;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/runStep.ts');

  // Exercise the function with a simple step
  const testStep: Step = {
    commands: ['echo "runStep test"'],
    options: {},
    nextStepType: 'none',
  };
  runStep(testStep, 0, { captureOutput: true }).then((result) =>
  {
    console.log('runStep() completed with result:');
    console.log(`  status: ${result.status}`);
    console.log(`  duration: ${result.durationMs}ms`);
    console.log(`  stdout captured: ${result.stdout?.trim()}`);
    console.log('<- executed ./src/script/runStep.ts');
  });
}
