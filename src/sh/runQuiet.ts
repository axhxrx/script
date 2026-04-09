import { execSync } from 'node:child_process';

export interface RunQuietOptions
{
  cwd?: string;
  /**
   When true, throw the underlying error instead of swallowing it and returning ''.
   Default: false (backward-compatible: errors are swallowed, returns '').
   */
  throwOnFailure?: boolean;
}

/**
 Execute a shell command silently and return output, or empty string on error.

 By default, errors are swallowed and an empty string is returned. Pass
 `{ throwOnFailure: true }` to throw on non-zero exit codes instead.

 The second parameter accepts either an options object or a plain string
 (interpreted as `cwd`) for backward compatibility.

 @param knownSafeCommand - The shell command to run. Obviously, don't pass user input, as it will be directly executed.
 @param optionsOrCwd - Options object, or a cwd string for backward compatibility
 @returns The command output as a trimmed string, or empty string if command fails (when throwOnFailure is false)

 @example
 ```ts
 // Default: swallow errors, return ''
 const username = runQuiet('whoami');

 // Throw on failure (still silent — no output streamed to terminal)
 try {
   const result = runQuiet('gh repo view org/repo', { throwOnFailure: true });
 } catch (error: unknown) {
   // command failed
 }
 ```
 */
export function runQuiet(knownSafeCommand: string, optionsOrCwd?: RunQuietOptions | string): string
{
  const opts: RunQuietOptions = typeof optionsOrCwd === 'string'
    ? { cwd: optionsOrCwd }
    : optionsOrCwd ?? {};

  try
  {
    const result = execSync(knownSafeCommand, {
      cwd: opts.cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: undefined,
    });
    return typeof result === 'string' ? result.trim() : '';
  }
  catch (error: unknown)
  {
    if (opts.throwOnFailure)
    {
      throw error;
    }
    return '';
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/sh/runQuiet.ts');

  // Exercise the function with a safe command
  const result = runQuiet('echo "runQuiet test"');
  console.log('runQuiet() returned:', result.trim());

  console.log('<- executed ./src/sh/runQuiet.ts');
}
