import process from 'node:process';
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

if (import.meta.main)
{
  console.log('-> executing ./src/git/getConfig.ts');

  // Exercise the function with a safe read-only operation
  const userName = getGitConfig('user.name', process.cwd());
  console.log('git user.name:', userName || '(not set)');

  console.log('<- executed ./src/git/getConfig.ts');
}
