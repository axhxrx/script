#!/usr/bin/env bun
/**
Test fixture for file logging feature.

This script is designed to be run by automated tests. It uses simple echo commands
to verify that file logging works correctly with different configurations.

The script outputs to JSON so tests can parse and verify the results.
*/

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createScript } from '@axhxrx/script';

// Generate unique log file paths
const scriptLogPath = join(tmpdir(), `test-script-${randomUUID()}.log`);
const step1LogPath = join(tmpdir(), `test-step1-${randomUUID()}.log`);
const step2LogPath = join(tmpdir(), `test-step2-${randomUUID()}.log`);

const script = createScript();

// Configure script-level logging
await script.file({
  path: scriptLogPath,
  output: 'full',
});

script.banner('Test Script');

// Step 1: Simple echo with step-specific logging
script.add('echo "STEP1_OUTPUT"')
  .description('Step 1: Basic echo')
  .file({ path: step1LogPath, output: 'command' });

// Step 2: Echo with .or() fallback - the first command succeeds so fallback won't run
script.add('echo "STEP2_PRIMARY"')
  .description('Step 2: With fallback')
  .file({ path: step2LogPath, output: 'command' })
  .or('echo "STEP2_FALLBACK"');

// Step 3: Echo that fails, triggers .or(), then .and() continues
script.add('exit 1')
  .description('Step 3: Fail then recover')
  .or('echo "STEP3_RECOVERED"')
  .and('echo "STEP3_CONTINUED"');

// Step 4: Function step with console.log (should be captured when file logging active)
script.add(async () =>
{
  console.log('FUNCTION_CONSOLE_LOG');
  console.warn('FUNCTION_CONSOLE_WARN');
}).description('Step 4: Function with console');

// Execute silently
const result = await script.execute({ yes: true, printResults: false });

// Read log files and output JSON for test verification
const scriptLog = await readFile(scriptLogPath, 'utf-8').catch(() => '');
const step1Log = await readFile(step1LogPath, 'utf-8').catch(() => '');
const step2Log = await readFile(step2LogPath, 'utf-8').catch(() => '');

// Output results as JSON for test parsing
const output = {
  success: result.state === 'complete',
  stepsRun: result.stepsRun,
  paths: {
    scriptLog: scriptLogPath,
    step1Log: step1LogPath,
    step2Log: step2LogPath,
  },
  logs: {
    scriptLog,
    step1Log,
    step2Log,
  },
};

console.log(JSON.stringify(output, null, 2));
