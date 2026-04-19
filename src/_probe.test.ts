/**
 Cross-runtime lifecycle-hook canary.

 Exercises the four lifecycle patterns used elsewhere in this codebase (top-level `afterEach`, describe-scoped `beforeEach`/`afterEach`, scope isolation across sibling describes, async `afterEach`) through the `_testkit.ts` shim, to verify they behave identically on Node, Bun, and Deno.

 Should fail if our assumptions become innvalid due to a library update. (Hopefully, that would be from a new version of the @stdtesting/bdd thing that fixes the Deno-only problem, so that this test and  shim can be deleted from this earth.)
 */

import { expect } from '@std/expect';
import process from 'node:process';
import { afterEach, beforeEach, describe, test } from './_testkit.ts';

const topLevelBuffer: string[] = [];

afterEach(() =>
{
  topLevelBuffer.length = 0;
});

test('top-level afterEach: first test populates buffer', () =>
{
  topLevelBuffer.push('a', 'b');
  expect(topLevelBuffer).toEqual(['a', 'b']);
});

test('top-level afterEach: second test sees cleared buffer', () =>
{
  expect(topLevelBuffer).toEqual([]);
  topLevelBuffer.push('c');
  expect(topLevelBuffer).toEqual(['c']);
});

describe('describe-scoped before/afterEach', () =>
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

  test('can mutate argv in test A', () =>
  {
    process.argv = ['x', 'y', '--probe-A'];
    expect(process.argv).toContain('--probe-A');
  });

  test('test B sees argv restored (no --probe-A leak)', () =>
  {
    expect(process.argv).not.toContain('--probe-A');
  });
});

let innerHookRuns = 0;

describe('scope isolation: inner hooks do not run outside', () =>
{
  beforeEach(() =>
  {
    innerHookRuns += 1;
  });

  test('inner test 1', () =>
  {
    expect(innerHookRuns).toBeGreaterThan(0);
  });

  test('inner test 2', () =>
  {
    expect(innerHookRuns).toBeGreaterThan(1);
  });
});

test('outer test: inner beforeEach should NOT have fired for me', () =>
{
  expect(innerHookRuns).toBe(2);
});

let asyncAfterEachRan = false;

describe('async afterEach', () =>
{
  afterEach(async () =>
  {
    await new Promise((r) => setTimeout(r, 5));
    asyncAfterEachRan = true;
  });

  test('triggers async afterEach', () =>
  {
    expect(true).toBe(true);
  });

  test('saw async afterEach from previous test', () =>
  {
    expect(asyncAfterEachRan).toBe(true);
  });
});
