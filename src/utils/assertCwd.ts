/**
 Assert that we're in the expected directory before dangerous operations.

 This is a safety check to prevent accidental execution in the wrong directory.

 @param expectedPath - The expected current working directory
 @param operation - Description of the operation being attempted (for error message)
 @throws Error if current directory doesn't match expected path

 @example
 ```ts
 assertCwd('/path/to/clone', 'run git reset --hard');
 ```
 */
import process from 'node:process';
export function assertCwd(
  expectedPath: string,
  operation: string,
): void
{
  const currentDir = process.cwd();
  if (currentDir !== expectedPath)
  {
    throw new Error(
      `SAFETY CHECK FAILED: Expected to be in "${expectedPath}" but we're in "${currentDir}". `
        + `Refusing to ${operation}.`,
    );
  }
}
