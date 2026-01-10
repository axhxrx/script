import { runQuiet } from '../sh/index.ts';

/**
 Get a git config value.

 @param key - The git config key (e.g., 'user.email')
 @param cwd - The directory to run git config in
 @returns The config value, or empty string if not set

 @example
 ```ts
 const email = getGitConfig('user.email', '/path/to/repo');
 ```
 */
export function getGitConfig(key: string, cwd: string): string
{
  return runQuiet(`git config "${key}"`, cwd);
}
