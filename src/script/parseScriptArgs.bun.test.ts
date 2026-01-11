import { describe, expect, test } from 'bun:test';

import { parseScriptArgs } from './parseScriptArgs.ts';

describe('parseScriptArgs', () =>
{
  test('returns defaults for empty args', () =>
  {
    const result = parseScriptArgs([]);
    expect(result.dryRun).toBe(false);
    expect(result.yes).toBe(false);
    expect(result.otherArgs).toEqual([]);
  });

  test('parses --dryRun', () =>
  {
    const result = parseScriptArgs(['--dryRun']);
    expect(result.dryRun).toBe(true);
    expect(result.yes).toBe(false);
  });

  test('parses --dry-run (kebab-case)', () =>
  {
    const result = parseScriptArgs(['--dry-run']);
    expect(result.dryRun).toBe(true);
  });

  test('parses -y', () =>
  {
    const result = parseScriptArgs(['-y']);
    expect(result.yes).toBe(true);
    expect(result.dryRun).toBe(false);
  });

  test('parses --yes', () =>
  {
    const result = parseScriptArgs(['--yes']);
    expect(result.yes).toBe(true);
  });

  test('collects other args', () =>
  {
    const result = parseScriptArgs(['staging', 'deploy', '--verbose']);
    expect(result.dryRun).toBe(false);
    expect(result.yes).toBe(false);
    expect(result.otherArgs).toEqual(['staging', 'deploy', '--verbose']);
  });

  test('parses mixed flags and args', () =>
  {
    const result = parseScriptArgs(['--dry-run', '-y', 'staging', 'deploy']);
    expect(result.dryRun).toBe(true);
    expect(result.yes).toBe(true);
    expect(result.otherArgs).toEqual(['staging', 'deploy']);
  });

  test('flags can appear in any order', () =>
  {
    const result = parseScriptArgs(['build', '--yes', 'test', '--dryRun', 'deploy']);
    expect(result.dryRun).toBe(true);
    expect(result.yes).toBe(true);
    expect(result.otherArgs).toEqual(['build', 'test', 'deploy']);
  });

  test('duplicate flags are handled gracefully', () =>
  {
    const result = parseScriptArgs(['--yes', '-y', '--dry-run', '--dryRun']);
    expect(result.dryRun).toBe(true);
    expect(result.yes).toBe(true);
    expect(result.otherArgs).toEqual([]);
  });
});
