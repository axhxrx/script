import { expect } from '@std/expect';

import { describe, test } from '@axhxrx/test';
import { splitCommandLines } from './splitCommandLines.ts';

describe('splitCommandLines', () =>
{
  test('splits simple multi-line commands', () =>
  {
    const result = splitCommandLines('echo hello\necho world');
    expect(result).toEqual(['echo hello', 'echo world']);
  });

  test('skips empty lines', () =>
  {
    const result = splitCommandLines('echo hello\n\n\necho world');
    expect(result).toEqual(['echo hello', 'echo world']);
  });

  test('skips comment lines', () =>
  {
    const result = splitCommandLines('# this is a comment\necho hello\n# another comment\necho world');
    expect(result).toEqual(['echo hello', 'echo world']);
  });

  test('trims leading and trailing whitespace', () =>
  {
    const result = splitCommandLines('  echo hello  \n  echo world  ');
    expect(result).toEqual(['echo hello', 'echo world']);
  });

  test('joins backslash continuations', () =>
  {
    const result = splitCommandLines('echo \\\nhello');
    // The backslash is replaced with a space, so 'echo ' + 'hello'
    expect(result).toEqual(['echo  hello']);
  });

  test('joins multiple backslash continuations', () =>
  {
    const result = splitCommandLines('echo \\\nhello \\\nworld');
    expect(result).toEqual(['echo  hello  world']);
  });

  test('handles trailing continuation as complete command', () =>
  {
    const result = splitCommandLines('echo hello \\');
    expect(result).toEqual(['echo hello']);
  });

  test('returns empty array for empty input', () =>
  {
    expect(splitCommandLines('')).toEqual([]);
  });

  test('returns empty array for only comments and blank lines', () =>
  {
    expect(splitCommandLines('# comment\n\n# another')).toEqual([]);
  });

  test('handles single command with no newlines', () =>
  {
    expect(splitCommandLines('echo hello')).toEqual(['echo hello']);
  });

  test('handles mix of comments, blanks, continuations, and commands', () =>
  {
    const input = [
      '# Build step',
      'npm run build',
      '',
      '# Deploy with',
      '# multiple flags',
      'deploy \\',
      '  --prod \\',
      '  --verbose',
      '',
      'echo done',
    ].join('\n');

    expect(splitCommandLines(input)).toEqual([
      'npm run build',
      'deploy  --prod  --verbose',
      'echo done',
    ]);
  });

  test('comment after continuation does not continue the command', () =>
  {
    const result = splitCommandLines('echo hello \\\n# comment\necho world');
    expect(result).toEqual(['echo hello  echo world']);
  });
});
