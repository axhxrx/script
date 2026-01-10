import { describe, expect, test } from 'bun:test';

import { run } from './run.ts';
import { runQuiet } from './runQuiet.ts';

describe('run', () =>
{
  test('should run command and return output', () =>
  {
    const output = run('echo "hello"', { silent: true });
    expect(output).toBe('hello');
  });

  test('should throw on invalid command when not silent', () =>
  {
    expect(() =>
    {
      run('this-command-does-not-exist-xyz-12345');
    }).toThrow();
  });

  test('should respect cwd option', () =>
  {
    const output = run('pwd', { cwd: '/tmp', silent: true });
    expect(output).toContain('/tmp');
  });

  test('should trim output', () =>
  {
    const output = run('echo "  spaces  "', { silent: true });
    expect(output).toBe('spaces');
  });
});

describe('runQuiet', () =>
{
  test('should return empty string on error', () =>
  {
    const output = runQuiet('this-command-does-not-exist-xyz-12345');
    expect(output).toBe('');
  });

  test('should run command and return output', () =>
  {
    const output = runQuiet('echo "test"');
    expect(output).toBe('test');
  });

  test('should respect cwd parameter', () =>
  {
    const output = runQuiet('pwd', '/tmp');
    expect(output).toContain('/tmp');
  });
});
