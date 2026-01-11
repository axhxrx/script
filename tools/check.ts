#!/usr/bin/env bun

import { add, execute, Script } from '@axhxrx/script';

// add('deno check');
// add('deno lint');
// add('bun test');
// add('ls INTENTIONAL_FAILING_STEP_just_for_example').onError('warn');
// add('dprint fmt **/*.ts');

// add(`
//   deno check \
//   deno lint

//   bun test
//   ls INTENTIONAL_FAILING_STEP_just_for_example
//   dprint fmt **/*.ts
//   `).onError('warn');

// const steps = `
//   deno check
//   deno lint
//   bun test
//   dprint fmt **/*.ts
//   `;
// add(steps);
// await execute({ yes: true });

const s = new Script();
s.add(`
  deno check
  deno lint
  bun test
  dprint fmt **/*.ts
`);
await s.execute();
