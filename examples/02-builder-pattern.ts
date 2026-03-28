#!/usr/bin/env bun
/**
 Builder pattern example: This example uses the `add()` function to add steps to the default global script.

 It illustrates how to use the builder-pattern methods to chain calls to step-modifiers like `.description()`, `.cwd()`, `.confirmations() `, and how to use  `.or()` / `.and()` to make compound steps that chain commands together.
 */

import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { add, banner, execute } from '@axhxrx/script';

const workspace = join(tmpdir(), `script-builder-${randomUUID()}`);

banner('Builder Pattern Example Demo');

add(`mkdir -p "${workspace}"`)
  .description('Create a temp workspace');

add('printf "dist/\\n" > .gitignore')
  .description('Write a config file')
  .cwd(workspace)
  .confirm('Write a demo .gitignore?', true);

add('test -f release-notes.md')
  .description('Find release notes')
  .cwd(workspace)
  .or('printf "# Release notes\\n\\n- Ship it\\n" > release-notes.md')
  .cwd(workspace)
  .and('cat release-notes.md')
  .cwd(workspace);

add(async () =>
{
  await rm(workspace, { recursive: true, force: true });
  console.log(`Cleaned up ${workspace}`);
}).description('Remove the temp workspace');

const result = await execute({ parseArgs: true });

if (result.aborted)
{
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} top-level step(s).`);
