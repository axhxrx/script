#!/usr/bin/env bun
import { add, banner, execute, runQuiet, switchGhAuth, validate } from '@axhxrx/script';

const tag = 'v0.1.0';

validate('On main branch', () =>
{
  const branch = runQuiet('git branch --show-current').trim();
  return branch === 'main' || `Expected main, on '${branch}'`;
});

banner('Release Prep');

add('deno install && deno check && deno lint')
  .description('Deno: check types & lint');

add('bun install && bun test ')
  .description('Bun: run test suite');

add(`gh release create ${tag} --draft --generate-notes`)
  .description(`Create draft GitHub release ${tag}`)
  .confirm(`Create draft release ${tag}?`)
  .or(switchGhAuth)
  .and(`gh release create ${tag} --draft --generate-notes`);

await execute();
