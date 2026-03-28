#!/usr/bin/env bun
/**
 Example showing function steps mixed with shell commands.
 */

import process from 'node:process';

import { add, banner, execute, runQuiet } from '@axhxrx/script';

function summarizeLocalChanges()
{
  const changed = runQuiet('git status --porcelain').trim();

  if (changed === '')
  {
    console.log('Working tree is clean');
    return;
  }

  const lines = changed.split('\n');
  console.log(`Changed files: ${lines.length}`);

  for (const line of lines.slice(0, 5))
  {
    console.log(`  ${line}`);
  }

  if (lines.length > 5)
  {
    console.log(`  ...and ${lines.length - 5} more`);
  }
}

banner('Repository Summary');

add(`echo "Working in $(pwd)..."`);

// Inline function step:
add(() =>
{
  const branch = runQuiet('git branch --show-current').trim() || '(detached HEAD)';
  console.log(`Branch: ${branch}`);
}).description('Show current branch');

// Named function step:
add(summarizeLocalChanges)
  .description('Summarize local changes');

add('git log --oneline -3')
  .description('Show recent commits');

const result = await execute();

if (result.aborted)
{
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} top-level step(s).`);
