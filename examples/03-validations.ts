#!/usr/bin/env -S deno run -A
/**
Example showing validation checks that run before script execution.

Validations are preconditions that must pass before any steps run. This is useful for checking that required tools are installed, environment variables are set, etc.
*/

import { add, execute, validate } from '../src/sh/index.ts';

// Validate that we're in a git repository
validate('In a git repository', () =>
{
  try
  {
    const process = new Deno.Command('git', {
      args: ['rev-parse', '--git-dir'],
      stdout: 'null',
      stderr: 'null',
    });
    const { success } = process.outputSync();
    return success || 'Not in a git repository. Please run from a git repo.';
  }
  catch
  {
    return 'Git is not installed';
  }
});

// Validate that deno is available
validate('Deno is installed', () =>
{
  try
  {
    const process = new Deno.Command('deno', {
      args: ['--version'],
      stdout: 'null',
      stderr: 'null',
    });
    const { success } = process.outputSync();
    return success;
  }
  catch
  {
    return 'Deno is not installed';
  }
});

// Now add the actual work
add('echo "All validations passed!"');
add('git status --short');

const result = await execute();

if (result.aborted)
{
  console.error('Script was aborted!');
  Deno.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} steps.`);
