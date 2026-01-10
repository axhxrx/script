#!/usr/bin/env -S deno run -A
/**
Example showing how to create isolated Script instances.

Use createScript() when you need multiple independent scripts, or for testing where you don't want to affect global state.
*/

import { createScript } from '../src/sh/index.ts';

// Create two isolated script instances
const buildScript = createScript();
const testScript = createScript();

// Configure the build script
buildScript.banner('🔨 Build Script');
buildScript.add('echo "Compiling..."').description('Compile');
buildScript.add('echo "Bundling..."').description('Bundle');

// Configure the test script
testScript.banner('🧪 Test Script');
testScript.add('echo "Running unit tests..."').description('Unit tests');
testScript.add('echo "Running integration tests..."').description('Integration tests');

// Ask user which to run
console.log('\nWhich script would you like to run?');
console.log('1. Build');
console.log('2. Test');
console.log('3. Both\n');

const choice = prompt('Enter choice (1-3):');

switch (choice)
{
  case '1':
    await buildScript.execute();
    break;
  case '2':
    await testScript.execute();
    break;
  case '3':
    console.log('\n--- Running Build ---\n');
    await buildScript.execute();
    console.log('\n--- Running Tests ---\n');
    await testScript.execute();
    break;
  default:
    console.log('Invalid choice, exiting.');
}
