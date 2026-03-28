#!/usr/bin/env bun
/**
 Minimal example: add a few commands and run them.

 Try:
   bun examples/01-basic.ts --dry-run
   bun examples/01-basic.ts --yes
 */

import process from 'node:process';

import { add, execute } from '@axhxrx/script';

add('echo "Hello from @axhxrx/script"');
add('echo "Current directory: $(pwd)"');
add('echo "Repository files:" && ls');

const result = await execute({ parseArgs: true });

if (result.aborted)
{
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} top-level step(s).`);
