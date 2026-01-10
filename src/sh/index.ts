/* eslint-disable no-console */

// Re-export all types and classes from their individual files
export { ask } from './ask.ts';
export { createScript } from './createScript.ts';
export type { ExecuteOptions } from './ExecuteOptions.ts';
export type { ExecuteResult } from './ExecuteResult.ts';
export { printBanner } from './printBanner.ts';
export { requireYes } from './requireYes.ts';
export { run } from './run.ts';
export { runQuiet } from './runQuiet.ts';
export { runStep } from './runStep.ts';
export { runValidation } from './runValidation.ts';
export type { ValidationResult } from './runValidation.ts';
export { ScriptBuilder } from './ScriptBuilder.ts';
export type { Step } from './Step.ts';
export type { StepFn } from './StepFn.ts';
export type { StepOptions } from './StepOptions.ts';
export type { Validation } from './Validation.ts';

// Import for use in this module
import type { ExecuteOptions } from './ExecuteOptions.ts';
import type { ExecuteResult } from './ExecuteResult.ts';
import { Script } from './Script.ts';
import type { ScriptBuilder } from './ScriptBuilder.ts';
import type { StepFn } from './StepFn.ts';
import type { StepOptions } from './StepOptions.ts';

// ============================================================================
// Global default Script instance and delegating functions
// ============================================================================

/**
 The global default Script instance. All module-level functions (`add`, `banner`, `validate`, `execute`, etc.) delegate to this instance.

 For most use cases, you don't need to access this directly — just use the module-level functions. For advanced use cases (testing, conditional script selection), use `createScript()` to create isolated instances.
 */
const defaultScript = new Script();

/**
 Add a command or function to the execution queue (using the global default Script).

 @param commandOrFn - Shell command string or async function to execute
 @param options - Optional directly-specified step options (builder-pattern usually more convenient though)
 @returns ScriptBuilder for builder-pattern configuration

 @example
 ```ts
 // Using options object
 add('pnpm build', { cwd: 'services/web' });

 // Using builder-pattern
 add('pnpm build')
   .description('Build the frontend')
   .cwd('services/web')
   .confirm('Ready to build?');

 // Using a function for complex logic
 add(async () => {
   const exists = runQuiet('git rev-parse --verify feature-branch') !== '';
   if (exists) {
     run('git checkout feature-branch');
   } else {
     run('git checkout -b feature-branch');
   }
 }).description('Checkout or create feature branch');
 ```
 */
export function add(
  commandOrFn: string | StepFn,
  options: StepOptions = {},
): ScriptBuilder
{
  return defaultScript.add(commandOrFn, options);
}

/**
 Add a banner that will be printed before the step at the current position (using the global default Script).

 @param text - Banner text
 */
export function banner(text: string): void
{
  defaultScript.banner(text);
}

/**
 Add a script-level validation check that runs before any steps execute (using the global default Script).

 Use this for preconditions that must be met before the script can run. You can use this to schedule validation checks at any point up until you call `execute()`, which will run them all.

 @param description - Human-readable description of what's being validated
 @param check - Function that returns true if valid, false/string/throw if invalid

 @example
 ```ts
 validate('Docker is running', () => {
   try {
     execSync('docker info', { stdio: 'ignore' });
     return true;
   } catch {
     return 'Docker daemon is not running. Please start Docker.';
   }
 });

 validate('Environment file exists', () => existsSync('.env.local'));
 ```
 */
export function validate(
  description: string,
  check: () => boolean | string | Promise<boolean | string>,
): void
{
  defaultScript.validate(description, check);
}

/**
 Execute all accumulated steps (using the global default Script).

 @param options - Execution options
 @returns Result object with execution status
 */
export async function execute(
  options: ExecuteOptions = {},
): Promise<ExecuteResult>
{
  return await defaultScript.execute(options);
}

/**
 Reset the global default Script's state (steps, validations, banners). Useful for testing.

 For isolated testing, prefer using `createScript()` instead of resetting the global state.
 */
export function reset(): void
{
  defaultScript.reset();
}

/**
 Get the current number of steps in the global default Script. Useful for testing.
 */
export function getStepCount(): number
{
  return defaultScript.getStepCount();
}
