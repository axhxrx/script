#!/usr/bin/env bun
/**
Example showing the builder pattern for configuring steps.

The builder pattern allows you to chain configuration methods for more readable and maintainable scripts.
*/

import process from 'node:process';

import { add, banner, execute } from '@axhxrx/script';

banner('🚀 Build Process');

add('echo "Checking environment..."')
  .description('Environment check');

add('echo "Installing dependencies..."')
  .description('Install dependencies')
  .confirm('Ready to install dependencies?');

add('echo "Building project..."')
  .description('Build project')
  .cwd('.'); // Could specify a different directory

add('echo "Running tests..."')
  .description('Run tests');

banner('✅ Cleanup');

add('echo "Cleaning up temp files..."')
  .description('Cleanup');

const result = await execute();

if (result.aborted)
{
  console.error('Build was aborted!');
  process.exit(1);
}

console.log(`Build completed! Ran ${result.stepsRun} steps.`);
