#!/usr/bin/env bun
/**
 Local-only example showing script-level logs, step logs, and fallback chains.

 Run:
   bun examples/05-file-logging.ts --yes
 */

import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { createScript } from '@axhxrx/script';

const workspace = join(tmpdir(), `script-logging-${randomUUID()}`);
const mainLogPath = join(tmpdir(), `script-main-${randomUUID()}.log`);
const commandLogPath = join(tmpdir(), `script-command-${randomUUID()}.log`);

const script = createScript();

await script.file({
  path: mainLogPath,
  output: 'full',
  timestamps: true,
});

script.banner('File Logging');

script.add(`mkdir -p "${workspace}"`)
  .description('Create a temp workspace');

script.add('printf "hello from a command log\\n"')
  .description('Write command output')
  .cwd(workspace)
  .file({ path: commandLogPath, output: 'command' });

script.add('test -f notes.txt')
  .description('Recover from a missing file')
  .cwd(workspace)
  .file({ path: commandLogPath, output: 'command' })
  .or('printf "created by fallback\\n" > notes.txt')
  .cwd(workspace)
  .and('cat notes.txt')
  .cwd(workspace);

script.add(async () =>
{
  console.log(`Main log: ${mainLogPath}`);
  console.log(`Command log: ${commandLogPath}`);
  await rm(workspace, { recursive: true, force: true });
  console.log(`Removed ${workspace}`);
}).description('Print log paths and clean up');

const result = await script.execute({ parseArgs: true });

if (result.aborted)
{
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} top-level step(s).`);
