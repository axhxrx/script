import { describe, expect, test } from 'bun:test';

import { assertCwd } from './index.ts';

describe('assertCwd', () => {
  test('should not throw when in expected directory', () => {
    const cwd = process.cwd();
    expect(() => {
      assertCwd(cwd, 'test operation');
    }).not.toThrow();
  });

  test('should throw when in wrong directory', () => {
    expect(() => {
      assertCwd('/this/path/does/not/match', 'dangerous operation');
    }).toThrow(/SAFETY CHECK FAILED/);
  });

  test('should include operation in error message', () => {
    try {
      assertCwd('/wrong/path', 'format hard drive');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toContain('format hard drive');
    }
  });

  test('should include both paths in error message', () => {
    const expectedPath = '/expected/path';
    const currentPath = process.cwd();

    try {
      assertCwd(expectedPath, 'test');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(expectedPath);
      expect(message).toContain(currentPath);
    }
  });
});
