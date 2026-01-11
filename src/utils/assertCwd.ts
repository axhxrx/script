import { realpathSync } from 'node:fs';
import process from 'node:process';

/**
 Assert that we're in the expected directory before dangerous operations.

 This is a safety check to prevent accidental execution in the wrong directory. Paths are resolved to their real paths (following symlinks) before comparison.

 @param expectedPath - The expected current working directory
 @param operation - Description of the operation being attempted (for error message)
 @throws Error if current directory doesn't match expected path

 @example
 ```ts
 assertCwd('/path/to/clone', 'run git reset --hard');
 ```
 */
export function assertCwd(
  expectedPath: string,
  operation: string,
): void
{
  const currentDir = realpathSync(process.cwd());

  let expectedDir: string;
  try
  {
    expectedDir = realpathSync(expectedPath);
  }
  catch (error: unknown)
  {
    // Expected path doesn't exist - definitely not where we should be
    throw new Error(
      `SAFETY CHECK FAILED: Expected path "${expectedPath}" does not exist. ` +
      `Currently in "${process.cwd()}" (resolved: "${currentDir}"). ` +
      `Refusing to ${operation}.`,
    );
  }

  if (currentDir !== expectedDir)
  {
    throw new Error(
      `SAFETY CHECK FAILED: Expected to be in "${expectedPath}" (resolved: "${expectedDir}") ` +
      `but we're in "${process.cwd()}" (resolved: "${currentDir}"). ` +
      `Refusing to ${operation}.`,
    );
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/utils/assertCwd.ts');

  // Test with current directory (should pass)
  try
  {
    assertCwd(process.cwd(), 'self-test');
    console.log('assertCwd function works correctly');
  }
  catch (_e)
  {
    console.log('assertCwd threw as expected for wrong cwd');
  }

  console.log('<- executed ./src/utils/assertCwd.ts');
}
