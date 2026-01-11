import { execSync } from 'node:child_process';

export interface RunOptions
{
  cwd?: string;
  silent?: boolean;
}

/**
 Run a shell command with real-time output streaming via `execSync()`.

 By default, output streams directly to the terminal (stdout/stderr inherited). This provides real-time feedback for long-running commands. The return value is empty in this mode since output goes directly to the terminal.

 Use `silent: true` to capture output instead of streaming it. In silent mode, output is captured and returned (or empty string on error, without throwing).

 For a simpler API when you just want to capture output, use `runQuiet()` instead.

 @param knownSafeCommand - The shell command to run. Obviously, don't pass user input, as it will be directly executed.
 @param options - Run options
 @returns Empty string in default mode (output streams to terminal), or captured output in silent mode
 @throws Error if the command fails and silent mode is not enabled

 @example
 ```ts
 // Real-time output to terminal (returns '')
 run('npm install');

 // Capture output silently
 const output = run('git status', { silent: true });

 // Or use runQuiet() for capturing:
 const version = runQuiet('node --version');
 ```
 */
export function run(
  knownSafeCommand: string,
  options: RunOptions = {},
): string
{
  try
  {
    const result = execSync(knownSafeCommand, {
      cwd: options.cwd,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    });
    return typeof result === 'string' ? result.trim() : '';
  }
  catch (error: unknown)
  {
    if (!options.silent)
    {
      throw error;
    }
    return '';
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/sh/run.ts');

  // Default mode: output streams to terminal, returns ''
  console.log('Running with inherit (output streams directly):');
  const inheritResult = run('echo "run.ts test - this streams to terminal"');
  console.log('Return value (empty because output went to terminal):', JSON.stringify(inheritResult));

  // Silent mode: output captured and returned
  const captured = run('echo "silent mode test"', { silent: true });
  console.log('run() with silent mode returned:', JSON.stringify(captured));

  console.log('<- executed ./src/sh/run.ts');
}
