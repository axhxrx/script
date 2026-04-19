import { expect } from '@std/expect';
import { join } from 'node:path';

import { getPathToRepoRoot } from '../../tools/getPathToRepoRoot.ts';
import { describe, test } from '../_testkit.ts';
import { getFileInfo } from './getFileInfo.ts';

describe('getFileInfo', () =>
{
  test('should return FileInfo for README.md', () =>
  {
    const repoRoot = getPathToRepoRoot();
    const readmePath = join(repoRoot, 'README.md');

    const fileInfo = getFileInfo(readmePath);

    // Check structure
    expect(fileInfo).toHaveProperty('name');
    expect(fileInfo).toHaveProperty('content');
    expect(fileInfo).toHaveProperty('hash');

    // Check values
    expect(fileInfo.name).toBe('README.md');
    expect(fileInfo.content).toContain('# @axhxrx/script'); // Assuming README has this
    expect(fileInfo.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash format
  });

  test('should handle non-existent file', () =>
  {
    const nonExistentPath = '/this/file/does/not/exist.txt';

    expect(() =>
    {
      getFileInfo(nonExistentPath);
    }).toThrow();
  });

  test('should generate consistent hash for same content', () =>
  {
    const repoRoot = getPathToRepoRoot();
    const readmePath = join(repoRoot, 'README.md');

    const fileInfo1 = getFileInfo(readmePath);
    const fileInfo2 = getFileInfo(readmePath);

    expect(fileInfo1.hash).toBe(fileInfo2.hash);
  });
});
