#!/usr/bin/env bun
/**
Example showing file logging with .or()/.and() chains.

This demonstrates a realistic git workflow:
1. Try to clone a repo (may fail if already exists or auth issues)
2. Use .or() to handle auth issues, then .and() to retry
3. Use .cwd() to work in the cloned directory
4. Log different steps to different files

Run with: bun examples/07-file-logging.ts --yes
*/

import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { createScript } from '@axhxrx/script';

const REPO_URL = 'https://github.com/axhxrx/script';
const CLONE_DIR = join(tmpdir(), `script-example-${randomUUID()}`);

// Create log file paths
const scriptLogPath = join(tmpdir(), `script-main-${randomUUID()}.log`);
const gitLogPath = join(tmpdir(), `script-git-${randomUUID()}.log`);
const ghLogPath = join(tmpdir(), `script-gh-${randomUUID()}.log`);

const script = createScript();

// Configure script-level logging (captures everything by default)
await script.file({
  path: scriptLogPath,
  output: 'full',
  timestamps: true,
});

script.banner('🚀 Git Clone with Fallback');

// Step 1: Try to clone - if it fails (e.g., auth issues), switch accounts and retry
script.add(`git clone ${REPO_URL} "${CLONE_DIR}"`)
  .description('Clone repository')
  .file({ path: gitLogPath, output: 'command' })
  .or('gh auth switch')
  .and(`git clone ${REPO_URL} "${CLONE_DIR}"`);

script.banner('📋 Repository Info');

// Step 2: Check git log in the cloned directory
script.add('git log --oneline -5')
  .description('Show recent commits')
  .cwd(CLONE_DIR)
  .file({ path: gitLogPath, output: 'command' });

// Step 3: Use gh cli to show repo info (logs to separate file)
script.add('gh repo view --json name,description,stargazerCount')
  .description('Fetch repo metadata via GitHub CLI')
  .cwd(CLONE_DIR)
  .file({ path: ghLogPath, output: 'command', redact: 'auto' });

script.banner('🧹 Cleanup');

// Step 4: Clean up the cloned directory
script.add(async () =>
{
  console.log(`Removing temp directory: ${CLONE_DIR}`);
  await rm(CLONE_DIR, { recursive: true, force: true });
  console.log('Cleanup complete!');
}).description('Remove temporary clone');

// Execute
const result = await script.execute({ yes: process.argv.includes('--yes') });

console.log('\n📝 Log files created:');
console.log(`  Script log: ${scriptLogPath}`);
console.log(`  Git log:    ${gitLogPath}`);
console.log(`  GH log:     ${ghLogPath}`);

if (result.aborted)
{
  console.error('\n❌ Script was aborted!');
  process.exit(1);
}

console.log(`\n✅ Done! Ran ${result.stepsRun} steps.`);
