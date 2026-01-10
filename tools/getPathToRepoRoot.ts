import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 Get the absolute path to the repo root directory. If you pass the optional `subpathComponents`, it will return the path to the monorepo root directory joined with the subpath components.

 This works by finding the current file's location and navigating up the expected directory structure, so it assumes that the layout of the repo is stable, and would need updating if we change this. (It has a test that should reveal this by failing, though.)
 */
export function getPathToRepoRoot(...subpathComponents: string[]): string
{
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);

  // Navigate up from `./tools` to repo root
  const repoRoot = join(currentDir, '..');

  const result = subpathComponents.length > 0 ? join(repoRoot, ...subpathComponents) : repoRoot;

  return result;
}
