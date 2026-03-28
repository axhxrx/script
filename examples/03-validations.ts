#!/usr/bin/env bun
/**
 Example showing pre-flight validations before any steps run.
 */

import { existsSync } from 'node:fs';
import process from 'node:process';

import { add, execute, runQuiet, validate } from '@axhxrx/script';

validate('package.json exists', () =>
{
  return existsSync('package.json') || 'Run this from a project root.';
});

validate('src directory exists', () =>
{
  return existsSync('src') || 'This example expects a src/ directory.';
});

validate('Git is installed', () =>
{
  try
  {
    runQuiet('git --version');
    return true;
  }
  catch
  {
    return 'Git is not installed.';
  }
});

add('echo "All validations passed."')
  .description('Confirm that all validations passed');

add('git status --short');

const result = await execute({ parseArgs: true });

if (result.aborted)
{
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} top-level step(s).`);
