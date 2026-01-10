#!/usr/bin/env -S deno run -A
/**
Example showing the builder pattern for configuring steps.

The builder pattern allows you to chain configuration methods for more readable and maintainable scripts.
*/

import { add, banner, execute } from '../src/sh/index.ts';

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
  Deno.exit(1);
}

console.log(`Build completed! Ran ${result.stepsRun} steps.`);
