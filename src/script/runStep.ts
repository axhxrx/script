/* eslint-disable no-console */

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

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
        await new Promise(r => setTimeout(r, 10));

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
  options: { cwd?: string; env?: Record<string, string> },
): Promise<{ exitCode: number; stdout: string; stderr: string }>
{
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
      process.stdout.write(text); // Stream to terminal
      stdout += text; // Capture
    });

    child.stderr.on('data', (data: Uint8Array) =>
    {
      const text = stderrDecoder.decode(data, { stream: true });
      process.stderr.write(text); // Stream to terminal
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
 Run a single step (either a shell command or a function) and return a StepResult.

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
  const { command, fn, options: stepOptions } = step;
  const desc = stepOptions.description || command || '[function step]';
  const captureOutput = options.captureOutput ?? true;

  // Determine step type
  const type: StepType = fn ? 'function' : stepOptions.interactive ? 'interactive' : 'command';

  console.log(`▶ ${desc}`);
  if (command && stepOptions.description)
  {
    console.log(`  $ ${command}`);
  }

  const startedAt = new Date();
  let status: StepStatus = 'success';
  let exitCode: number | undefined;
  let stdout: string | undefined;
  let stderr: string | undefined;
  let error: Error | undefined;

  try
  {
    if (fn)
    {
      // Execute function step - no output capture possible
      await fn();
    }
    else if (command)
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

        exitCode = result.status ?? undefined;

        if (result.status !== 0 && stepOptions.onError !== 'continue')
        {
          const err = new Error(
            `Command failed with exit code ${result.status}`,
          );
          if (stepOptions.onError === 'warn')
          {
            console.warn(`⚠️  ${err.message}`);
            status = 'warning';
          }
          else
          {
            throw err;
          }
        }
      }
      else if (captureOutput)
      {
        // Use platform-specific capture: tee on Unix, TextDecoder fallback on Windows
        const captureCommand = isUnix ? runCommandWithTee : runCommandWithCapture;
        const result = await captureCommand(command, {
          cwd: stepOptions.cwd,
          env: stepOptions.env,
        });

        exitCode = result.exitCode;
        stdout = result.stdout;
        stderr = result.stderr;

        if (result.exitCode !== 0 && stepOptions.onError !== 'continue')
        {
          const err = new Error(
            `Command failed with exit code ${result.exitCode}`,
          );
          if (stepOptions.onError === 'warn')
          {
            console.warn(`⚠️  ${err.message}`);
            status = 'warning';
          }
          else
          {
            throw err;
          }
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

        exitCode = result.status ?? undefined;

        if (result.status !== 0 && stepOptions.onError !== 'continue')
        {
          const err = new Error(
            `Command failed with exit code ${result.status}`,
          );
          if (stepOptions.onError === 'warn')
          {
            console.warn(`⚠️  ${err.message}`);
            status = 'warning';
          }
          else
          {
            throw err;
          }
        }
      }
    }

    console.log('✓ Done\n');
  }
  catch (err: unknown)
  {
    error = err instanceof Error ? err : new Error(String(err));

    if (stepOptions.onError === 'warn')
    {
      console.warn(`⚠️  Warning: ${error.message}\n`);
      status = 'warning';
    }
    else if (stepOptions.onError === 'continue')
    {
      console.log('✓ Continued (error ignored)\n');
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
    command,
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
  const testStep: Step = { command: 'echo "runStep test"', options: {} };
  runStep(testStep, 0, { captureOutput: true }).then((result) =>
  {
    console.log('runStep() completed with result:');
    console.log(`  status: ${result.status}`);
    console.log(`  duration: ${result.durationMs}ms`);
    console.log(`  stdout captured: ${result.stdout?.trim()}`);
    console.log('<- executed ./src/script/runStep.ts');
  });
}
