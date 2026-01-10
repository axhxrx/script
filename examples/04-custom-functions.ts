#!/usr/bin/env bun
/**
Example showing custom async functions instead of shell commands.

You can pass async functions to add() for complex logic that can't be expressed as a simple shell command.
*/

import process from 'node:process';

import { add, banner, execute, runQuiet } from '@axhxrx/script';

banner('🔍 Git Branch Manager');

// Using a custom function for complex logic
add(async () =>
{
  await Promise.resolve();

  const currentBranch = runQuiet('git branch --show-current').trim();
  console.log(`  Currently on branch: ${currentBranch}`);

  if (currentBranch === 'main' || currentBranch === 'master')
  {
    console.log('  ✓ On main branch, good to go!');
  }
  else
  {
    console.log(`  ⚠ Not on main branch (on ${currentBranch})`);
  }
}).description('Check current branch');

// Another custom function that uses conditionals
add(async () =>
{
  await Promise.resolve();

  const status = runQuiet('git status --porcelain');

  if (status.trim() === '')
  {
    console.log('  ✓ Working directory is clean');
  }
  else
  {
    const lines = status.trim().split('\n').length;
    console.log(`  ⚠ Working directory has ${lines} changed file(s)`);
  }
}).description('Check working directory status');

// Mix regular commands with custom functions
add('echo "Regular command works too!"');

const result = await execute();

if (result.aborted)
{
  console.error('Script was aborted!');
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} steps.`);
