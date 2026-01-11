#!/usr/bin/env bun

import { add, execute } from '@axhxrx/script';

// add('deno check');
// add('deno lint');
// add('bun test');
// add('ls INTENTIONAL_FAILING_STEP_just_for_example').onError('warn');
// add('dprint fmt **/*.ts');

add(`
  deno check \
  deno lint 

  bun test
  ls INTENTIONAL_FAILING_STEP_just_for_example
  dprint fmt **/*.ts
  `).onError('warn');

await execute();
