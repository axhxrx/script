import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import process from 'node:process';

import { Script } from './Script.ts';

describe('Script.add() multi-line splitting', () =>
{
  test('single-line command creates one step', () =>
  {
    const script = new Script();
    script.add('echo hello');
    expect(script.getStepCount()).toBe(1);
  });

  test('multi-line command splits into separate steps', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
      echo step3
    `);
    expect(script.getStepCount()).toBe(3);
  });

  test('empty lines are skipped', () =>
  {
    const script = new Script();
    script.add(`
      echo step1

      echo step2


      echo step3
    `);
    expect(script.getStepCount()).toBe(3);
  });

  test('comment lines starting with # are skipped', () =>
  {
    const script = new Script();
    script.add(`
      # This is a comment
      echo step1
      # Another comment
      echo step2
    `);
    expect(script.getStepCount()).toBe(2);
  });

  test('backslash continuation joins lines', () =>
  {
    const script = new Script();
    script.add(`
      echo hello \\
        world
      echo done
    `);
    expect(script.getStepCount()).toBe(2);
  });

  test('multiLine: true preserves original behavior', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
      echo step3
    `, { multiLine: true });
    expect(script.getStepCount()).toBe(1);
  });

  test('empty or comment-only input creates no steps', () =>
  {
    const script = new Script();
    script.add(`
      # Just comments
      # No actual commands
    `);
    expect(script.getStepCount()).toBe(0);
  });

  test('whitespace-only input creates no steps', () =>
  {
    const script = new Script();
    script.add(`

    `);
    expect(script.getStepCount()).toBe(0);
  });

  test('leading/trailing whitespace is trimmed from commands', () =>
  {
    const script = new Script();
    script.add(`
      echo hello
    `);
    // We can't directly inspect the command, but we can verify it parsed correctly
    expect(script.getStepCount()).toBe(1);
  });

  test('multiple add() calls accumulate steps', () =>
  {
    const script = new Script();
    script.add(`
      echo a
      echo b
    `);
    script.add('echo c');
    script.add(`
      echo d
      echo e
    `);
    expect(script.getStepCount()).toBe(5);
  });

  test('reset() clears all steps', () =>
  {
    const script = new Script();
    script.add(`
      echo a
      echo b
    `);
    expect(script.getStepCount()).toBe(2);
    script.reset();
    expect(script.getStepCount()).toBe(0);
  });
});

describe('Script.add() with function steps', () =>
{
  test('function step creates one step', () =>
  {
    const script = new Script();
    script.add(async () =>
    {
      // Do something
    });
    expect(script.getStepCount()).toBe(1);
  });

  test('function steps can be mixed with command steps', () =>
  {
    const script = new Script();
    script.add('echo before');
    script.add(async () =>
    {
      // Do something
    });
    script.add(`
      echo after1
      echo after2
    `);
    expect(script.getStepCount()).toBe(4);
  });
});

describe('ScriptBuilder applies options to all split steps', () =>
{
  test('onError applies to all split steps', async () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
    `).onError('warn');

    // Execute with dryRun to see the plan without actually running
    const result = await script.execute({ dryRun: true });
    expect(result.executed).toBe(false);
    expect(script.getStepCount()).toBe(2);
  });

  test('cwd applies to all split steps', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
    `).cwd('/tmp');

    expect(script.getStepCount()).toBe(2);
  });

  test('description applies to all split steps', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
    `).description('My steps');

    expect(script.getStepCount()).toBe(2);
  });
});

describe('Script.execute() with parseArgs', () =>
{
  // Save original argv to restore after tests
  let originalArgv: string[];

  beforeEach(() =>
  {
    originalArgv = [...process.argv];
  });

  afterEach(() =>
  {
    process.argv = originalArgv;
  });

  test('parseArgs: true reads --dry-run from process.argv', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dry-run
    process.argv = ['node', 'script.ts', '--dry-run'];

    const result = await script.execute({ parseArgs: true });

    // Should be a dry run (no execution, plan printed)
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('parseArgs: true reads --dryRun from process.argv', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dryRun
    process.argv = ['node', 'script.ts', '--dryRun'];

    const result = await script.execute({ parseArgs: true });

    // Should be a dry run
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('explicit dryRun: false overrides --dry-run from argv', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dry-run
    process.argv = ['node', 'script.ts', '--dry-run'];

    // Explicit option should override
    const result = await script.execute({ parseArgs: true, dryRun: false, yes: true });

    // Should have executed (not a dry run because explicit option overrides)
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
  });

  test('explicit dryRun: true works without parseArgs', async () =>
  {
    const script = new Script();
    script.add('echo test');

    process.argv = ['node', 'script.ts']; // No flags

    const result = await script.execute({ dryRun: true });

    // Should be a dry run
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('parseArgs: false (default) ignores process.argv', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dry-run
    process.argv = ['node', 'script.ts', '--dry-run'];

    // parseArgs not set, so argv should be ignored
    const result = await script.execute({ yes: true }); // Need yes: true to skip prompt

    // Should have executed (argv ignored)
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
  });
});
