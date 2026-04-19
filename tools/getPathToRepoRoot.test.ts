import { expect } from '@std/expect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, test } from '@axhxrx/test';
import { getPathToRepoRoot } from './getPathToRepoRoot.ts';

describe('getPathToRepoRoot', () =>
{
  test('should return a valid monorepo root path', () =>
  {
    const root = getPathToRepoRoot();

    // Check that it's an absolute path
    expect(root).toMatch(/^\//);

    // Check that important monorepo files exist at this path
    expect(existsSync(join(root, 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'tsconfig.json'))).toBe(true);
  });

  test('should return consistent path when called multiple times', () =>
  {
    const path1 = getPathToRepoRoot();
    const path2 = getPathToRepoRoot();

    expect(path1).toBe(path2);
  });
});
