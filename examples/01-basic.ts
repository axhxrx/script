#!/usr/bin/env -S deno run -A
/**
Basic example showing simple command execution with the Script module.

This demonstrates the simplest usage pattern - just adding shell commands and executing them.
*/

import { add, execute } from '../src/mod.ts';

// Add some simple commands
add('echo "Hello from Script!"');
add('echo "Current directory: $(pwd)"');
add('ls -la');

// Execute all steps
const result = await execute();

if (result.aborted)
{
  console.error('Script was aborted!');
  Deno.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} steps.`);
