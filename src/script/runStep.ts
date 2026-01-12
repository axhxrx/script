/* eslint-disable no-console */

import { spawn, spawnSync } from 'node:child_process';
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
 Run a command using spawn with real-time streaming and optional output capture.
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

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Uint8Array) =>
    {
      const text = new TextDecoder().decode(data);
      process.stdout.write(text); // Stream to terminal
      stdout += text; // Capture
    });

    child.stderr.on('data', (data: Uint8Array) =>
    {
      const text = new TextDecoder().decode(data);
      process.stderr.write(text); // Stream to terminal
      stderr += text; // Capture
    });

    child.on('close', (code) =>
    {
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
        // Use spawn with stream capture for non-interactive commands
        const result = await runCommandWithCapture(command, {
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
