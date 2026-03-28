#!/usr/bin/env bun
/**
 Example showing independent Script instances via createScript().

 Usage:
   bun examples/07-create-script.ts [build|test|both] [--dry-run] [--yes]
 */

import { createScript, parseScriptArgs } from '@axhxrx/script';

const { dryRun, yes, otherArgs } = parseScriptArgs();
const mode = (['build', 'test', 'both'].find((value) => otherArgs.includes(value)) ?? 'both') as
  | 'build'
  | 'test'
  | 'both';

const buildScript = createScript();
buildScript.banner('Build Script');
buildScript.add('echo "Compiling..."').description('Compile');
buildScript.add('echo "Bundling..."').description('Bundle');

const testScript = createScript();
testScript.banner('Test Script');
testScript.add('echo "Running unit tests..."').description('Unit tests');
testScript.add('echo "Running integration tests..."').description('Integration tests');

if (mode === 'build' || mode === 'both')
{
  await buildScript.execute({ dryRun, yes });
}

if (mode === 'test' || mode === 'both')
{
  await testScript.execute({ dryRun, yes });
}
