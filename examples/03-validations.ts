#!/usr/bin/env bun
/**
Example showing validation checks that run before script execution.

Validations are preconditions that must pass before any steps run. This is useful for checking that required tools are installed, environment variables are set, etc.
*/

import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { add, execute, validate } from '@axhxrx/script';

// Validate that we're in a git repository
validate('In a git repository', () =>
{
  try
  {
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      stdio: 'pipe',
    });
    return result.status === 0 || 'Not in a git repository. Please run from a git repo.';
  }
  catch
  {
    return 'Git is not installed';
  }
});

// Validate that node is available
validate('Node.js is installed', () =>
{
  try
  {
    const result = spawnSync('node', ['--version'], {
      stdio: 'pipe',
    });
    return result.status === 0;
  }
  catch
  {
    return 'Node.js is not installed';
  }
});

// Now add the actual work
add('echo "All validations passed!"');
add('git status --short');

const result = await execute();

if (result.aborted)
{
  console.error('Script was aborted!');
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} steps.`);
