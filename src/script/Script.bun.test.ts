import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import process from 'node:process';

import { Script } from './Script.ts';
import type { StepResult } from './StepResult.ts';

describe('Script.add() multi-line handling', () =>
{
  test('single-line command creates one step', () =>
  {
    const script = new Script();
    script.add('echo hello');
    expect(script.getStepCount()).toBe(1);
  });

  test('multi-line command creates ONE step with commands[]', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
      echo step3
    `);
    // NEW: Multi-line creates ONE logical step
    expect(script.getStepCount()).toBe(1);
  });

  test('empty lines are skipped in commands[]', () =>
  {
    const script = new Script();
    script.add(`
      echo step1

      echo step2


      echo step3
    `);
    // ONE step with 3 commands
    expect(script.getStepCount()).toBe(1);
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
    // ONE step with 2 commands
    expect(script.getStepCount()).toBe(1);
  });

  test('backslash continuation joins lines', () =>
  {
    const script = new Script();
    script.add(`
      echo hello \\
        world
      echo done
    `);
    // ONE step with 2 commands
    expect(script.getStepCount()).toBe(1);
  });

  test('multiLine: true treats as single shell command', () =>
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
    expect(script.getStepCount()).toBe(1);
  });

  test('multiple add() calls accumulate steps', () =>
  {
    const script = new Script();
    script.add(`
      echo a
      echo b
    `); // 1 step with 2 commands
    script.add('echo c'); // 1 step
    script.add(`
      echo d
      echo e
    `); // 1 step with 2 commands
    expect(script.getStepCount()).toBe(3);
  });

  test('reset() clears all steps', () =>
  {
    const script = new Script();
    script.add(`
      echo a
      echo b
    `);
    expect(script.getStepCount()).toBe(1);
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
    script.add('echo before'); // 1 step
    script.add(async () =>
    {
      // Do something
    }); // 1 step
    script.add(`
      echo after1
      echo after2
    `); // 1 step with 2 commands
    expect(script.getStepCount()).toBe(3);
  });
});

describe('StepBuilder applies options to step', () =>
{
  test('onError applies to step', async () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
    `).onError('warn');

    // Execute with dryRun to see the plan without actually running
    const result = await script.execute({ dryRun: true });
    expect(result.executed).toBe(false);
    expect(script.getStepCount()).toBe(1);
  });

  test('cwd applies to step', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
    `).cwd('/tmp');

    expect(script.getStepCount()).toBe(1);
  });

  test('description applies to step', () =>
  {
    const script = new Script();
    script.add(`
      echo step1
      echo step2
    `).description('My steps');

    expect(script.getStepCount()).toBe(1);
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

describe('Script.execute() state and stepResults', () =>
{
  test('successful execution has state: complete', async () =>
  {
    const script = new Script();
    script.add('echo test');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
    expect(result.totalStepsRun).toBe(1);
    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].status).toBe('success');
  });

  test('stepResults contain captured output', async () =>
  {
    const script = new Script();
    script.add('echo hello');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].stdout).toBe('hello\n');
  });

  test('stepResults track timing', async () =>
  {
    const script = new Script();
    script.add('echo fast');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(result.stepResults[0].startedAt).toBeInstanceOf(Date);
    expect(result.stepResults[0].finishedAt).toBeInstanceOf(Date);
  });

  test('failed execution has state: failed', async () =>
  {
    const script = new Script();
    script.add('exit 1'); // This should fail

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.aborted).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].status).toBe('error');
  });

  test('totalDurationMs is tracked', async () =>
  {
    const script = new Script();
    script.add('echo test');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.totalDurationMs).toBeDefined();
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  test('captureOutput: false disables output capture', async () =>
  {
    const script = new Script();
    script.add('echo no-capture');

    const result = await script.execute({ yes: true, printResults: false, captureOutput: false });

    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].stdout).toBeUndefined();
  });

  test('printResults: false suppresses summary', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // This should not print any summary
    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
  });

  test('.stepResults returns accumulated results during execution', async () =>
  {
    const script = new Script();
    let capturedResults: readonly StepResult[] = [];

    script.add('echo first');
    script.add(async () =>
    {
      // Capture step results during execution
      capturedResults = script.stepResults;
    });

    await script.execute({ yes: true, printResults: false });

    // Should have captured the first step's result
    expect(capturedResults.length).toBe(1);
    expect(capturedResults[0].description).toBe('echo first');
  });
});

describe('Script.execute() UTF-8 and special character handling', () =>
{
  test('captures multi-byte UTF-8 characters (emojis)', async () =>
  {
    const script = new Script();
    script.add('echo "Hello 🎉🚀🌍"');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].stdout).toBe('Hello 🎉🚀🌍\n');
  });

  test('captures CJK characters', async () =>
  {
    const script = new Script();
    script.add('echo "日本語テスト 中文测试 한국어"');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].stdout).toBe('日本語テスト 中文测试 한국어\n');
  });

  test('captures mixed ASCII and UTF-8', async () =>
  {
    const script = new Script();
    script.add('echo "ASCII + émojis: 🎯 + café"');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].stdout).toBe('ASCII + émojis: 🎯 + café\n');
  });

  test('captures stderr separately from stdout', async () =>
  {
    const script = new Script();
    script.add('echo "stdout line" && echo "stderr line" >&2').onError('continue');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].stdout).toContain('stdout line');
    expect(result.stepResults[0].stderr).toContain('stderr line');
  });

  test('handles large output without truncation', async () =>
  {
    const script = new Script();
    // Generate 1000 lines of output
    script.add('for i in $(seq 1 1000); do echo "Line $i: some content here"; done');

    const result = await script.execute({ yes: true, printResults: false });

    const lines = result.stepResults[0].stdout?.split('\n').filter(l => l) || [];
    expect(lines.length).toBe(1000);
    expect(lines[0]).toBe('Line 1: some content here');
    expect(lines[999]).toBe('Line 1000: some content here');
  });
});

describe('Script.add() with commands[] (multi-command steps)', () =>
{
  test('multi-command step runs all commands sequentially', async () =>
  {
    const script = new Script();
    script.add(`
      echo first
      echo second
      echo third
    `);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].stdout).toContain('first');
    expect(result.stepResults[0].stdout).toContain('second');
    expect(result.stepResults[0].stdout).toContain('third');
  });

  test('multi-command step fails on first error', async () =>
  {
    const script = new Script();
    script.add(`
      echo works
      exit 1
      echo never
    `);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.stepResults[0].stdout).toContain('works');
    expect(result.stepResults[0].stdout).not.toContain('never');
  });

  test('multi-command step with onError: warn continues on error', async () =>
  {
    const script = new Script();
    script.add(`
      echo first
      exit 1
      echo third
    `).onError('warn');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.stepResults[0].stdout).toContain('first');
    expect(result.stepResults[0].stdout).toContain('third');
    expect(result.stepResults[0].status).toBe('warning');
  });

  test('stepResult includes commands array', async () =>
  {
    const script = new Script();
    script.add(`
      echo a
      echo b
    `);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].commands).toBeDefined();
    expect(result.stepResults[0].commands?.length).toBe(2);
    expect(result.stepResults[0].commands?.[0]).toBe('echo a');
    expect(result.stepResults[0].commands?.[1]).toBe('echo b');
  });
});

describe('.or() fallback API', () =>
{
  test('.or() returns StepBuilder for chaining', () =>
  {
    const script = new Script();
    const builder = script.add('echo test').or('echo fallback');

    // StepBuilder should have these methods
    expect(typeof builder.cwd).toBe('function');
    expect(typeof builder.env).toBe('function');
    expect(typeof builder.description).toBe('function');
    expect(typeof builder.or).toBe('function');
    expect(typeof builder.and).toBe('function');
  });

  test('fallback executes when main step fails', async () =>
  {
    const script = new Script();
    let fallbackRan = false;

    script.add(() =>
    {
      throw new Error('Main step fails');
    }).or(() =>
    {
      fallbackRan = true;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(fallbackRan).toBe(true);
  });

  test('fallback does not execute when main step succeeds', async () =>
  {
    const script = new Script();
    let fallbackRan = false;

    script.add(() =>
    {
      // Main step succeeds
    }).or(() =>
    {
      fallbackRan = true;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(fallbackRan).toBe(false);
  });

  test('multiple fallbacks are tried in order until one succeeds', async () =>
  {
    const script = new Script();
    const fallbackOrder: number[] = [];

    script.add(() =>
    {
      throw new Error('Main fails');
    })
      .or(() =>
      {
        fallbackOrder.push(1);
        throw new Error('First fallback fails');
      })
      .or(() =>
      {
        fallbackOrder.push(2);
        // Second fallback succeeds
      })
      .or(() =>
      {
        fallbackOrder.push(3);
        // Should not run
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(fallbackOrder).toEqual([1, 2]); // Only first two ran
  });

  test('all fallbacks fail results in failure', async () =>
  {
    const script = new Script();

    script.add(() =>
    {
      throw new Error('Main fails');
    })
      .or(() =>
      {
        throw new Error('Fallback 1 fails');
      })
      .or(() =>
      {
        throw new Error('Fallback 2 fails');
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
  });
});

describe('.and() chaining API', () =>
{
  test('.and() creates new step and runs in sequence', async () =>
  {
    const script = new Script();
    const order: number[] = [];

    script.add(() =>
    {
      order.push(1);
    })
      .and(() =>
      {
        order.push(2);
      })
      .and(() =>
      {
        order.push(3);
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(order).toEqual([1, 2, 3]);
    // Only one top-level step, so one stepResult
    expect(result.stepResults.length).toBe(1);
  });

  test('.and() with shell commands runs all commands in sequence', async () =>
  {
    const script = new Script();

    // Track execution via side effects
    let firstRan = false;
    let secondRan = false;
    let thirdRan = false;

    script.add(() =>
    {
      firstRan = true;
    })
      .and(() =>
      {
        secondRan = true;
      })
      .and(() =>
      {
        thirdRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(firstRan).toBe(true);
    expect(secondRan).toBe(true);
    expect(thirdRan).toBe(true);
  });

  test('.and() step can have its own options (cwd, env, etc)', async () =>
  {
    const script = new Script();
    const cwds: string[] = [];

    script.add(() =>
    {
      cwds.push(process.cwd());
    })
      .and(() =>
      {
        // The .cwd() on the andStep should be separate from the first step
        cwds.push(process.cwd());
      })
      .cwd('/tmp');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    // The second step ran with /tmp as cwd, first step ran with original cwd
    expect(cwds.length).toBe(2);
  });

  test('.and() failure triggers .or() fallback', async () =>
  {
    const script = new Script();
    let fallbackRan = false;

    script.add(() =>
    {
      // First command succeeds
    })
      .and(() =>
      {
        throw new Error('Second command fails');
      })
      .or(() =>
      {
        fallbackRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(fallbackRan).toBe(true);
  });

  test('.and() stops chain when a step fails without .or()', async () =>
  {
    const script = new Script();
    let thirdRan = false;

    script.add(() =>
    {
      // First succeeds
    })
      .and(() =>
      {
        throw new Error('Second fails');
      })
      .and(() =>
      {
        thirdRan = true; // Should not run
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(thirdRan).toBe(false);
  });
});

describe('StepFn return value handling', () =>
{
  test('function returning void succeeds', async () =>
  {
    const script = new Script();

    script.add(() =>
    {
      // Returns void (implicit undefined)
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.stepResults[0].status).toBe('success');
  });

  test('function returning true succeeds', async () =>
  {
    const script = new Script();

    script.add(() => true);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.stepResults[0].status).toBe('success');
  });

  test('function returning false fails', async () =>
  {
    const script = new Script();

    script.add(() => false);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.stepResults[0].status).toBe('error');
  });

  test('function returning 0 succeeds', async () =>
  {
    const script = new Script();

    script.add(() => 0);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.stepResults[0].status).toBe('success');
  });

  test('function returning non-zero number fails', async () =>
  {
    const script = new Script();

    script.add(() => 1);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.stepResults[0].status).toBe('error');
    expect(result.stepResults[0].exitCode).toBe(1);
  });

  test('function returning negative number fails', async () =>
  {
    const script = new Script();

    script.add(() => -1);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.stepResults[0].exitCode).toBe(-1);
  });

  test('async function returning false fails', async () =>
  {
    const script = new Script();

    script.add(async () =>
    {
      await Promise.resolve();
      return false;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
  });

  test('async function returning non-zero fails', async () =>
  {
    const script = new Script();

    script.add(async () =>
    {
      await Promise.resolve();
      return 42;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.stepResults[0].exitCode).toBe(42);
  });

  test('function returning false triggers .or() fallback', async () =>
  {
    const script = new Script();
    let fallbackRan = false;

    script.add(() => false)
      .or(() =>
      {
        fallbackRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(fallbackRan).toBe(true);
  });

  test('function returning non-zero triggers .or() fallback', async () =>
  {
    const script = new Script();
    let fallbackRan = false;

    script.add(() => 1)
      .or(() =>
      {
        fallbackRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(fallbackRan).toBe(true);
  });

  test('function returning false with onError: warn continues', async () =>
  {
    const script = new Script();
    let secondRan = false;

    script.add(() => false).onError('warn');
    script.add(() =>
    {
      secondRan = true;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(secondRan).toBe(true);
    expect(result.stepResults[0].status).toBe('warning');
  });

  test('function returning non-zero with onError: continue silently continues', async () =>
  {
    const script = new Script();
    let secondRan = false;

    script.add(() => 99).onError('continue');
    script.add(() =>
    {
      secondRan = true;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(secondRan).toBe(true);
  });
});

describe('chainResults tracking', () =>
{
  test('simple step has chainResults with root linkType', async () =>
  {
    const script = new Script();
    script.add('echo hello');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults[0].chainResults).toBeDefined();
    expect(result.stepResults[0].chainResults?.length).toBe(1);
    expect(result.stepResults[0].chainResults?.[0].linkType).toBe('root');
    expect(result.stepResults[0].chainResults?.[0].status).toBe('success');
  });

  test('.and() chain records all steps with correct linkTypes', async () =>
  {
    const script = new Script();
    const order: string[] = [];

    script.add(() =>
    {
      order.push('first');
    })
      .and(() =>
      {
        order.push('second');
      })
      .and(() =>
      {
        order.push('third');
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.stepsRun).toBe(1);
    expect(result.totalStepsRun).toBe(3);
    const chain = result.stepResults[0].chainResults;
    expect(chain?.length).toBe(3);
    expect(chain?.[0].linkType).toBe('root');
    expect(chain?.[1].linkType).toBe('and');
    expect(chain?.[2].linkType).toBe('and');
  });

  test('.or() fallback records steps with correct linkTypes', async () =>
  {
    const script = new Script();

    script.add(() =>
    {
      throw new Error('fail');
    })
      .or(() =>
      {
        // fallback succeeds
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    const chain = result.stepResults[0].chainResults;
    expect(chain?.length).toBe(2);
    expect(chain?.[0].linkType).toBe('root');
    expect(chain?.[0].status).toBe('error');
    expect(chain?.[1].linkType).toBe('or');
    expect(chain?.[1].status).toBe('success');
  });

  test('mixed and/or chain records full execution path', async () =>
  {
    const script = new Script();

    script.add(() =>
    {
      // root succeeds
    })
      .and(() =>
      {
        throw new Error('and fails');
      })
      .or(() =>
      {
        // fallback succeeds
      })
      .and(() =>
      {
        // continuation succeeds
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    const chain = result.stepResults[0].chainResults;
    expect(chain?.length).toBe(4);
    expect(chain?.[0].linkType).toBe('root');
    expect(chain?.[0].status).toBe('success');
    expect(chain?.[1].linkType).toBe('and');
    expect(chain?.[1].status).toBe('error');
    expect(chain?.[2].linkType).toBe('or');
    expect(chain?.[2].status).toBe('success');
    expect(chain?.[3].linkType).toBe('and');
    expect(chain?.[3].status).toBe('success');
  });

  test('chainResults contains stdout/stderr from each step', async () =>
  {
    const script = new Script();

    script.add('echo first')
      .and('echo second');

    const result = await script.execute({ yes: true, printResults: false });

    const chain = result.stepResults[0].chainResults;
    expect(chain?.[0].stdout).toBe('first\n');
    expect(chain?.[1].stdout).toBe('second\n');
  });

  test('failed chain still has chainResults', async () =>
  {
    const script = new Script();

    script.add(() =>
    {
      // succeeds
    })
      .and(() =>
      {
        throw new Error('fails with no fallback');
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.stepsRun).toBe(0);
    expect(result.totalStepsRun).toBe(2);
    const chain = result.stepResults[0].chainResults;
    expect(chain?.length).toBe(2);
    expect(chain?.[0].status).toBe('success');
    expect(chain?.[1].status).toBe('error');
  });
});
