import { run } from '../sh/index.ts';

/**
 Set a git config value.

 @param key - The git config key (e.g., 'user.name')
 @param value - The value to set
 @param cwd - The directory to run git config in
 @throws Error if git config fails

 @example
 ```ts
 setGitConfig('user.name', 'John Doe', '/path/to/repo');
 ```
 */
export function setGitConfig(key: string, value: string, cwd: string): void
{
  run(`git config "${key}" "${value}"`, { cwd });
}
