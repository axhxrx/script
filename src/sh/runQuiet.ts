import { run } from './run.ts';

/**
 Execute a shell command silently and return output, or empty string on error.

 This is a convenience wrapper around exec() with silent: true.

 @param knownSafeCommand - The shell command to run. Obviously, don't pass user input, as it will be directly executed.
 @param cwd - Optional working directory
 @returns The command output as a trimmed string, or empty string if command fails

 @example
 ```ts
 const username = runQuiet('whoami');
 ```
 */
export function runQuiet(knownSafeCommand: string, cwd?: string): string {
  return run(knownSafeCommand, { cwd, silent: true });
}
