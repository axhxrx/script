import { execSync } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  silent?: boolean;
}

/**
 Run a shell command with `execSync() and return the output, or throw on error.

 @param knownSafeCommand - The shell command to run. Obviously, don't pass user input, as it will be directly executed.
 @param options - Run options
 @returns The command output as a trimmed string
 @throws Error if the command fails and silent mode is not enabled

 @example
 ```ts
 const output = run('git status');
 ```

 @example
 ```ts
 const output = run('ls -la', { cwd: '/tmp', silent: true });
 ```
 */
export function run(
  knownSafeCommand: string,
  options: RunOptions = {},
): string {
  try {
    const result = execSync(knownSafeCommand, {
      cwd: options.cwd,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    });
    return typeof result === 'string' ? result.trim() : '';
  } catch (error) {
    if (!options.silent) {
      throw error;
    }
    return '';
  }
}
