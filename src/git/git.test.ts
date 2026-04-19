import { expect } from '@std/expect';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, test } from '@axhxrx/test';
import { run } from '../sh/index.ts';

import { getGitConfig, setGitConfig } from './index.ts';

describe('git config utilities', () =>
{
  test('should set and get git config', () =>
  {
    // Create a temporary git repo
    const tempDir = mkdtempSync(join(tmpdir(), 'git-test-'));

    try
    {
      run('git init', { cwd: tempDir, silent: true });

      setGitConfig('user.name', 'Test User', tempDir);
      const name = getGitConfig('user.name', tempDir);

      expect(name).toBe('Test User');
    }
    finally
    {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should return empty string for non-existent config', () =>
  {
    const tempDir = mkdtempSync(join(tmpdir(), 'git-test-'));

    try
    {
      run('git init', { cwd: tempDir, silent: true });
      const value = getGitConfig('this.does.not.exist', tempDir);
      expect(value).toBe('');
    }
    finally
    {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle values with spaces', () =>
  {
    const tempDir = mkdtempSync(join(tmpdir(), 'git-test-'));

    try
    {
      run('git init', { cwd: tempDir, silent: true });

      setGitConfig('user.name', 'John Doe Smith', tempDir);
      const name = getGitConfig('user.name', tempDir);

      expect(name).toBe('John Doe Smith');
    }
    finally
    {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
