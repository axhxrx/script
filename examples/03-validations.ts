#!/usr/bin/env bun
/**
Example showing validation checks that run before script execution.

Validations are preconditions that must pass before any steps run. This is useful for checking that required tools are installed, environment variables are set, etc.
*/

import process from 'node:process';

import { add, execute, runQuiet, validate } from '@axhxrx/script';

// Validate that we're in a git repository
validate('In a git repository', () =>
{
  const gitDir = runQuiet('git rev-parse --git-dir');
  return gitDir !== '' || 'Not in a git repository. Please run from a git repo.';
});

// Validate that node is available
validate('Node.js is installed', () =>
{
  const version = runQuiet('node --version');
  return version !== '' || 'Node.js is not installed';
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
