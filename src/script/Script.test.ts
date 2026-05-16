import { assert } from '@std/assert';
import { expect } from '@std/expect';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { afterEach, beforeEach, describe, test } from '@axhxrx/test';
import { Script } from './Script.ts';
import type { StepResult } from './StepResult.ts';

const scriptModuleUrl = new URL('../mod.ts', import.meta.url).href;

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

  test('parses --dry-run from process.argv by default', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dry-run
    process.argv = ['node', 'script.ts', '--dry-run'];

    const result = await script.execute();

    // Should be a dry run (no execution, plan printed)
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('parses --dryRun from process.argv by default', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dryRun
    process.argv = ['node', 'script.ts', '--dryRun'];

    const result = await script.execute();

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
    const result = await script.execute({ dryRun: false, yes: true });

    // Should have executed (not a dry run because explicit option overrides)
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
  });

  test('explicit dryRun: true still works', async () =>
  {
    const script = new Script();
    script.add('echo test');

    process.argv = ['node', 'script.ts']; // No flags

    const result = await script.execute({ dryRun: true });

    // Should be a dry run
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('parseArgs: false ignores process.argv', async () =>
  {
    const script = new Script();
    script.add('echo test');

    // Simulate: ./script.ts --dry-run
    process.argv = ['node', 'script.ts', '--dry-run'];

    const result = await script.execute({ parseArgs: false, yes: true });

    // Should have executed (argv ignored)
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
  });
});

describe('Bug regressions', () =>
{
  test('yes: true suppresses per-step confirmations in Deno subprocesses', () =>
  {
    const code = `
import { createScript } from ${JSON.stringify(scriptModuleUrl)};
const script = createScript();
script.add('echo hello').confirm('Run this?', true);
const result = await script.execute({ yes: true, printResults: false });
console.log(JSON.stringify({ aborted: result.aborted, stepsRun: result.stepsRun }));
`;

    const result = spawnSync('deno', ['eval', code], {
      encoding: 'utf-8',
      timeout: 2000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"stepsRun":1');
    expect(result.stdout).not.toContain('Run this? [Y/n]:');
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('success');
  });

  test('stepResults contain captured output', async () =>
  {
    const script = new Script();
    script.add('echo hello');

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepResults.length).toBe(1);
    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toBe('hello\n');
  });

  test('stepResults track timing', async () =>
  {
    const script = new Script();
    script.add('echo fast');

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    expect(step.durationMs).toBeGreaterThanOrEqual(0);
    expect(step.startedAt).toBeInstanceOf(Date);
    expect(step.finishedAt).toBeInstanceOf(Date);
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('error');
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toBeUndefined();
  });

  test('Unix capture path reports missing bash/tee clearly', async () =>
  {
    if (process.platform === 'win32')
    {
      return;
    }

    const script = new Script();
    script.add('echo test').env({ PATH: '' });

    const result = await script.execute({
      yes: true,
      printResults: false,
      captureOutput: true,
    });

    expect(result.state).toBe('failed');
    expect(result.error).toBeDefined();
    // With an empty PATH, either failure mode is acceptable — the test's
    // purpose is only to confirm that a comprehensible error is produced.
    // Runtimes resolve child executables differently: Bun looks up `bash` via
    // the parent's PATH and then fails on the tee-check inside bash
    // ("Could not find tee"); Node/Deno use libuv which looks up via the
    // child's PATH, so bash itself can't spawn and we get "Could not start
    // bash". Both share the "bash and tee" prefix.
    const message = result.error?.message ?? '';
    expect(message).toContain('bash and tee');
    expect(
      message.includes('Could not find tee') || message.includes('Could not start bash'),
    ).toBe(true);
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
    script.add(() =>
    {
      // Capture step results during execution
      capturedResults = script.stepResults;
    });

    await script.execute({ yes: true, printResults: false });

    // Should have captured the first step's result
    expect(capturedResults.length).toBe(1);
    const captured = capturedResults[0];
    assert(captured);
    expect(captured.description).toBe('echo first');
  });
});

describe('Script.execute() UTF-8 and special character handling', () =>
{
  test('captures multi-byte UTF-8 characters (emojis)', async () =>
  {
    const script = new Script();
    script.add('echo "Hello 🎉🚀🌍"');

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toBe('Hello 🎉🚀🌍\n');
  });

  test('captures CJK characters', async () =>
  {
    const script = new Script();
    script.add('echo "日本語テスト 中文测试 한국어"');

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toBe('日本語テスト 中文测试 한국어\n');
  });

  test('captures mixed ASCII and UTF-8', async () =>
  {
    const script = new Script();
    script.add('echo "ASCII + émojis: 🎯 + café"');

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toBe('ASCII + émojis: 🎯 + café\n');
  });

  test('captures stderr separately from stdout', async () =>
  {
    const script = new Script();
    script.add('echo "stdout line" && echo "stderr line" >&2').onError('continue');

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toContain('stdout line');
    expect(step.stderr).toContain('stderr line');
  });

  test('handles large output without truncation', async () =>
  {
    const script = new Script();
    // Generate 1000 lines of output
    script.add('for i in $(seq 1 1000); do echo "Line $i: some content here"; done');

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    const lines = step.stdout?.split('\n').filter(l => l) || [];
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toContain('first');
    expect(step.stdout).toContain('second');
    expect(step.stdout).toContain('third');
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toContain('works');
    expect(step.stdout).not.toContain('never');
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toContain('first');
    expect(step.stdout).toContain('third');
    expect(step.status).toBe('warning');
  });

  test('stepResult includes commands array', async () =>
  {
    const script = new Script();
    script.add(`
      echo a
      echo b
    `);

    const result = await script.execute({ yes: true, printResults: false });

    const step = result.stepResults[0];
    assert(step);
    expect(step.commands).toBeDefined();
    expect(step.commands?.length).toBe(2);
    expect(step.commands?.[0]).toBe('echo a');
    expect(step.commands?.[1]).toBe('echo b');
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

describe('.or() then .and() interaction', () =>
{
  test('A.or(B).and(C): when A succeeds, chain stops — C does NOT run', async () =>
  {
    const script = new Script();
    let bRan = false;
    let cRan = false;

    script.add(() =>
    {
      // A succeeds
    })
      .or(() =>
      {
        bRan = true;
      })
      .and(() =>
      {
        cRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(bRan).toBe(false);
    expect(cRan).toBe(false);
  });

  test('A.or(B).and(C): when A fails and B succeeds, C runs', async () =>
  {
    const script = new Script();
    const order: string[] = [];

    script.add(() =>
    {
      order.push('A');
      throw new Error('A fails');
    })
      .or(() =>
      {
        order.push('B');
      })
      .and(() =>
      {
        order.push('C');
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(order).toEqual(['A', 'B', 'C']);
  });

  test('A.or(B).and(C): when A fails and B also fails, C does NOT run', async () =>
  {
    const script = new Script();
    let cRan = false;

    script.add(() =>
    {
      throw new Error('A fails');
    })
      .or(() =>
      {
        throw new Error('B also fails');
      })
      .and(() =>
      {
        cRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    expect(cRan).toBe(false);
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('success');
  });

  test('function returning true succeeds', async () =>
  {
    const script = new Script();

    script.add(() => true);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('success');
  });

  test('function returning false fails', async () =>
  {
    const script = new Script();

    script.add(() => false);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('error');
  });

  test('function returning 0 succeeds', async () =>
  {
    const script = new Script();

    script.add(() => 0);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('success');
  });

  test('function returning non-zero number fails', async () =>
  {
    const script = new Script();

    script.add(() => 1);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('error');
    expect(step.exitCode).toBe(1);
  });

  test('function returning negative number fails', async () =>
  {
    const script = new Script();

    script.add(() => -1);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('failed');
    const step = result.stepResults[0];
    assert(step);
    expect(step.exitCode).toBe(-1);
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.exitCode).toBe(42);
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
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('warning');
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

    const step = result.stepResults[0];
    assert(step);
    expect(step.chainResults).toBeDefined();
    expect(step.chainResults?.length).toBe(1);
    expect(step.chainResults?.[0]?.linkType).toBe('root');
    expect(step.chainResults?.[0]?.status).toBe('success');
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
    const chain = result.stepResults[0]?.chainResults;
    expect(chain?.length).toBe(3);
    expect(chain?.[0]?.linkType).toBe('root');
    expect(chain?.[1]?.linkType).toBe('and');
    expect(chain?.[2]?.linkType).toBe('and');
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
    const chain = result.stepResults[0]?.chainResults;
    expect(chain?.length).toBe(2);
    expect(chain?.[0]?.linkType).toBe('root');
    expect(chain?.[0]?.status).toBe('error');
    expect(chain?.[1]?.linkType).toBe('or');
    expect(chain?.[1]?.status).toBe('success');
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
    const chain = result.stepResults[0]?.chainResults;
    expect(chain?.length).toBe(4);
    expect(chain?.[0]?.linkType).toBe('root');
    expect(chain?.[0]?.status).toBe('success');
    expect(chain?.[1]?.linkType).toBe('and');
    expect(chain?.[1]?.status).toBe('error');
    expect(chain?.[2]?.linkType).toBe('or');
    expect(chain?.[2]?.status).toBe('success');
    expect(chain?.[3]?.linkType).toBe('and');
    expect(chain?.[3]?.status).toBe('success');
  });

  test('chainResults contains stdout/stderr from each step', async () =>
  {
    const script = new Script();

    script.add('echo first')
      .and('echo second');

    const result = await script.execute({ yes: true, printResults: false });

    const chain = result.stepResults[0]?.chainResults;
    expect(chain?.[0]?.stdout).toBe('first\n');
    expect(chain?.[1]?.stdout).toBe('second\n');
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
    const chain = result.stepResults[0]?.chainResults;
    expect(chain?.length).toBe(2);
    expect(chain?.[0]?.status).toBe('success');
    expect(chain?.[1]?.status).toBe('error');
  });
});

describe('Script-level validations with --dry-run and --skip-validations', () =>
{
  let originalArgv: string[];

  beforeEach(() =>
  {
    originalArgv = [...process.argv];
  });

  afterEach(() =>
  {
    process.argv = originalArgv;
  });

  test('dry-run with passing validation prints plan and completes', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.validate('always passes', () =>
    {
      validationRan = true;
      return true;
    });
    script.add('echo test');

    const result = await script.execute({ dryRun: true, parseArgs: false, printResults: false });

    expect(validationRan).toBe(true);
    expect(result.state).toBe('complete');
    expect(result.aborted).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('dry-run with failing validation aborts and does NOT print plan', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.validate('always fails', () =>
    {
      validationRan = true;
      return 'computer says no';
    });
    script.add('echo never');

    const result = await script.execute({ dryRun: true, parseArgs: false, printResults: false });

    expect(validationRan).toBe(true);
    expect(result.state).toBe('failed');
    expect(result.aborted).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('--skip-validations + failing validation runs plan (real execution)', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.validate('always fails', () =>
    {
      validationRan = true;
      return 'this would block execution';
    });
    script.add('echo skipped-validations-real-run');

    const result = await script.execute({
      skipValidations: true,
      yes: true,
      parseArgs: false,
      printResults: false,
    });

    expect(validationRan).toBe(false);
    expect(result.state).toBe('complete');
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
    const step = result.stepResults[0];
    assert(step);
    expect(step.stdout).toBe('skipped-validations-real-run\n');
  });

  test('--skip-validations + --dry-run + failing validation prints plan, completes', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.validate('always fails', () =>
    {
      validationRan = true;
      return 'preview-only failure';
    });
    script.add('echo plan-step');

    const result = await script.execute({
      dryRun: true,
      skipValidations: true,
      parseArgs: false,
      printResults: false,
    });

    expect(validationRan).toBe(false);
    expect(result.state).toBe('complete');
    expect(result.aborted).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('parses --skip-validations from process.argv by default', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.validate('always fails', () =>
    {
      validationRan = true;
      return false;
    });
    script.add('echo cli-parsed');

    process.argv = ['node', 'script.ts', '--skip-validations'];

    const result = await script.execute({ yes: true, printResults: false });

    expect(validationRan).toBe(false);
    expect(result.state).toBe('complete');
    expect(result.executed).toBe(true);
    expect(result.stepsRun).toBe(1);
  });

  test('explicit skipValidations: false overrides --skip-validations from argv', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.validate('always fails', () =>
    {
      validationRan = true;
      return 'blocked';
    });
    script.add('echo unreachable');

    process.argv = ['node', 'script.ts', '--skip-validations'];

    const result = await script.execute({
      skipValidations: false,
      yes: true,
      printResults: false,
    });

    expect(validationRan).toBe(true);
    expect(result.state).toBe('failed');
    expect(result.aborted).toBe(true);
  });

  test('real run with failing validation still aborts (unchanged from prior behavior)', async () =>
  {
    const script = new Script();
    script.validate('always fails', () => 'no');
    script.add('echo unreachable');

    const result = await script.execute({ yes: true, parseArgs: false, printResults: false });

    expect(result.state).toBe('failed');
    expect(result.aborted).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.stepsRun).toBe(0);
  });

  test('dry-run with no validations completes (regression)', async () =>
  {
    const script = new Script();
    script.add('echo nothing-to-validate');

    const result = await script.execute({ dryRun: true, parseArgs: false, printResults: false });

    expect(result.state).toBe('complete');
    expect(result.executed).toBe(false);
  });
});

describe('.skipIf() — conditional step skipping', () =>
{
  test('skipIf(true) skips the step', async () =>
  {
    const script = new Script();
    let stepRan = false;

    script.add(() =>
    {
      stepRan = true;
    }).skipIf(true);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(stepRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
    expect(result.stepsRun).toBe(0);
    expect(result.stepResults.length).toBe(1);
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('skipped');
    expect(step.skipReason).toBe('skipIf condition met');
  });

  test('skipIf(false) does not skip the step', async () =>
  {
    const script = new Script();
    let stepRan = false;

    script.add(() =>
    {
      stepRan = true;
    }).skipIf(false);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(stepRan).toBe(true);
    expect(result.stepsRun).toBe(1);
    expect(result.stepsSkipped).toBe(0);
  });

  test('skipIf with function evaluated lazily at execution time', async () =>
  {
    const script = new Script();
    let conditionChecked = false;
    let stepRan = false;

    script.add(() =>
    {
      stepRan = true;
    }).skipIf(() =>
    {
      conditionChecked = true;
      return true;
    });

    // Condition should not have been checked yet (lazy evaluation)
    expect(conditionChecked).toBe(false);

    const result = await script.execute({ yes: true, printResults: false });

    expect(conditionChecked).toBe(true);
    expect(stepRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });

  test('skipIf with async function', async () =>
  {
    const script = new Script();
    let stepRan = false;

    script.add(() =>
    {
      stepRan = true;
    }).skipIf(async () =>
    {
      await Promise.resolve();
      return true;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(stepRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });

  test('skipIf on root step skips entire chain including .or() and .and()', async () =>
  {
    const script = new Script();
    let orRan = false;
    let andRan = false;

    script.add(() =>
    {
      throw new Error('root fails');
    })
      .skipIf(true)
      .or(() =>
      {
        orRan = true;
      })
      .and(() =>
      {
        andRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(orRan).toBe(false);
    expect(andRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });

  test('skipIf on .or() sub-step skips entire chain', async () =>
  {
    const script = new Script();
    let rootRan = false;
    let orRan = false;
    let andRan = false;

    script.add(() =>
    {
      rootRan = true;
      throw new Error('root fails');
    })
      .or(() =>
      {
        orRan = true;
      })
      .skipIf(true)
      .and(() =>
      {
        andRan = true;
      });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(rootRan).toBe(false);
    expect(orRan).toBe(false);
    expect(andRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });

  test('skipIf on .and() sub-step skips entire chain', async () =>
  {
    const script = new Script();
    let rootRan = false;
    let andRan = false;

    script.add(() =>
    {
      rootRan = true;
    })
      .and(() =>
      {
        andRan = true;
      })
      .skipIf(true);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(rootRan).toBe(false);
    expect(andRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });

  test('skipIf does not affect other steps in the script', async () =>
  {
    const script = new Script();
    let step1Ran = false;
    let step2Ran = false;
    let step3Ran = false;

    script.add(() =>
    {
      step1Ran = true;
    });
    script.add(() =>
    {
      step2Ran = true;
    }).skipIf(true);
    script.add(() =>
    {
      step3Ran = true;
    });

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.state).toBe('complete');
    expect(step1Ran).toBe(true);
    expect(step2Ran).toBe(false);
    expect(step3Ran).toBe(true);
    expect(result.stepsRun).toBe(2);
    expect(result.stepsSkipped).toBe(1);
  });

  test('skipIf function returning false allows execution', async () =>
  {
    const script = new Script();
    let stepRan = false;

    script.add(() =>
    {
      stepRan = true;
    }).skipIf(() => false);

    const result = await script.execute({ yes: true, printResults: false });

    expect(stepRan).toBe(true);
    expect(result.stepsRun).toBe(1);
    expect(result.stepsSkipped).toBe(0);
  });

  test('skipIf works with shell command steps', async () =>
  {
    const script = new Script();

    script.add('echo should-not-run').skipIf(true);

    const result = await script.execute({ yes: true, printResults: false });

    expect(result.stepsSkipped).toBe(1);
    const step = result.stepResults[0];
    assert(step);
    expect(step.status).toBe('skipped');
    expect(step.stdout).toBeUndefined();
  });

  test('skipIf short-circuits before step-level validation', async () =>
  {
    const script = new Script();
    let validationRan = false;

    script.add('echo hello')
      .validate(() =>
      {
        validationRan = true;
        return true;
      })
      .skipIf(true);

    const result = await script.execute({ yes: true, printResults: false });

    // skipIf is checked before validation, so validation should NOT have run
    expect(validationRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });

  test('multiple skipIf conditions — first truthy one triggers skip', async () =>
  {
    const script = new Script();
    let rootRan = false;
    let andRan = false;

    script.add(() =>
    {
      rootRan = true;
    })
      .skipIf(false) // root: don't skip
      .and(() =>
      {
        andRan = true;
      })
      .skipIf(true); // and: skip — this causes the whole chain to skip

    const result = await script.execute({ yes: true, printResults: false });

    expect(rootRan).toBe(false);
    expect(andRan).toBe(false);
    expect(result.stepsSkipped).toBe(1);
  });
});
