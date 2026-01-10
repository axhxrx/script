#!/usr/bin/env bun
/**
Basic example showing simple command execution with the Script module.

This demonstrates the simplest usage pattern - just adding shell commands and executing them.
*/

import process from 'node:process';

import { add, execute } from '@axhxrx/script';

// Add some simple commands
add('echo "Hello from Script!"');
add('echo "Current directory: $(pwd)"');
add('ls -la');

// Execute all steps
const result = await execute();

if (result.aborted)
{
  console.error('Script was aborted!');
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} steps.`);
