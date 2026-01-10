/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';

import process from 'node:process';
import { promptYesNo } from '../prompts/index.ts';
import { run } from '../sh/index.ts';

/**
 A validation check that runs before execution.
 */
export interface Validation
{
  /**
   Human-readable description of what's being validated.
   */
  description: string;

  /**
   The validation function. Return true if valid, false or throw if invalid. Can also return a string error message on failure.
   */
  check: () => boolean | string | Promise<boolean | string>;
}

/**
 `StepOptions` is the raw config for a step.
 */
export interface StepOptions
{
  /**
   Human-readable description. Defaults to the command itself.
   */
  description?: string;

  /**
   Working directory for the command.
   */
  cwd?: string;

  /**
   Use spawnSync with stdio:inherit for commands that need terminal interaction (e.g., gcloud auth which opens a browser).
   */
  interactive?: boolean;

  /**
   Additional environment variables.
   */
  env?: Record<string, string>;

  /**
   What to do on error. Default: 'fail'
   - 'fail': throw and stop execution
   - 'warn': log warning and continue
   - 'continue': silently continue
   */
  onError?: 'fail' | 'warn' | 'continue';

  /**
   Confirmation prompt to show before executing this step. If set, user will be asked during execution phase.
   */
  confirmPrompt?: string;

  /**
   Default value for confirm prompt. Default: true
   */
  confirmDefault?: boolean;

  /**
   Whether this step can be skipped if the user declines confirmation.
   - true (default): skip this step and continue with the sequence
   - false: abort the entire sequence if user declines
   */
  canSkip?: boolean;

  /**
   Validation function that runs right before this step executes. Useful for checks that depend on outputs from previous steps. Return true if valid, false or throw if invalid. Can also return a string error message on failure.
   */
  validateFn?: () => boolean | string | Promise<boolean | string>;

  /**
   Human-readable description of the step validation.
   */
  validateDescription?: string;
}

/**
 A step function that can be executed instead of a shell command.
 */
export type StepFn = () => void | Promise<void>;

interface Step
{
  command?: string;
  fn?: StepFn;
  options: StepOptions;
}

export interface ExecuteOptions
{
  /**
   Print the plan without executing.
   */
  dryRun?: boolean;

  /**
   Skip the confirmation prompt and run immediately. By default, execute() shows the plan and asks for confirmation.
   */
  yes?: boolean;

  /**
   Prompt for confirmation before each individual step. Individual steps can also have their own .confirm() setting.
   */
  confirmEach?: boolean;
}

export interface ExecuteResult
{
  /**
   Whether any steps were actually executed.
   */
  executed: boolean;

  /**
   Number of steps that ran successfully.
   */
  stepsRun: number;

  /**
   Number of steps that were skipped.
   */
  stepsSkipped: number;

  /**
   Whether the user aborted before execution.
   */
  aborted: boolean;
}

/**
 Builder for configuring individual steps with a fluent API.
 */
export class ScriptBuilder
{
  constructor(private step: Step)
  {}

  /**
   Set a human-readable description for this step.
   */
  description(desc: string): this
  {
    this.step.options.description = desc;
    return this;
  }

  /**
   Set the working directory for this step.
   */
  cwd(path: string): this
  {
    this.step.options.cwd = path;
    return this;
  }

  /**
   Mark this step as interactive (uses spawnSync with stdio:inherit). Useful for commands that open browsers or need terminal interaction.
   */
  interactive(value = true): this
  {
    this.step.options.interactive = value;
    return this;
  }

  /**
   Set additional environment variables for this step.
   */
  env(vars: Record<string, string>): this
  {
    this.step.options.env = { ...this.step.options.env, ...vars };
    return this;
  }

  /**
   Set error handling behavior.
   - 'fail': throw and stop execution (default)
   - 'warn': log warning and continue
   - 'continue': silently continue
   */
  onError(behavior: 'fail' | 'warn' | 'continue'): this
  {
    this.step.options.onError = behavior;
    return this;
  }

  /**
   Add a confirmation prompt that will be shown during execution. This is different from ask() which runs during planning.

   @param question - The question to ask (default: "Run this step?")
   @param defaultYes - Default answer (default: true)
   */
  confirm(question?: string, defaultYes = true): this
  {
    this.step.options.confirmPrompt = question ?? 'Run this step?';
    this.step.options.confirmDefault = defaultYes;
    return this;
  }

  /**
   Set whether this step can be skipped if the user declines confirmation.
   - true (default): skip this step and continue with the sequence
   - false: abort the entire sequence if user declines

   Only meaningful if .confirm() is also set.
   */
  canSkip(value = true): this
  {
    this.step.options.canSkip = value;
    return this;
  }

  /**
   Add a validation check that runs right before this step executes. Useful for checks that depend on outputs from previous steps.

   @param check - Function that returns true if valid, false/string/throw if invalid
   @param description - Human-readable description of what's being validated
   */
  validate(
    check: () => boolean | string | Promise<boolean | string>,
    description?: string,
  ): this
  {
    this.step.options.validateFn = check;
    this.step.options.validateDescription = description;
    return this;
  }
}

/**
 Run a validation check and return the result.
 */
async function runValidation(
  validation: Validation,
): Promise<{ passed: boolean; error?: string }>
{
  try
  {
    const result = await validation.check();
    if (result === true)
    {
      return { passed: true };
    }
    else if (result === false)
    {
      return { passed: false };
    }
    else
    {
      // String error message
      return { passed: false, error: result };
    }
  }
  catch (error: unknown)
  {
    return {
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 Print a prominent banner.
 */
function printBanner(text: string): void
{
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${line}`);
  console.log(`║ ${text} ║`);
  console.log(`${line}\n`);
}

/**
 Run a single step (either a shell command or a function).
 */
async function runStep(step: Step): Promise<void>
{
  const { command, fn, options } = step;
  const desc = options.description || command || '[function step]';

  console.log(`▶ ${desc}`);
  if (command && options.description)
  {
    console.log(`  $ ${command}`);
  }

  try
  {
    if (fn)
    {
      // Execute function step
      await fn();
    }
    else if (command)
    {
      if (options.interactive)
      {
        // Use spawnSync for interactive commands (browser auth flows, etc.)
        const result = spawnSync(command, {
          stdio: 'inherit',
          cwd: options.cwd,
          shell: true,
          env: { ...process.env, ...options.env },
        });

        if (result.status !== 0 && options.onError !== 'continue')
        {
          const error = new Error(
            `Command failed with exit code ${result.status}`,
          );
          if (options.onError === 'warn')
          {
            console.warn(`⚠️  ${error.message}`);
          }
          else
          {
            throw error;
          }
        }
      }
      else
      {
        // Use exec for non-interactive commands
        run(command, { cwd: options.cwd });
      }
    }

    console.log('✓ Done\n');
  }
  catch (error: unknown)
  {
    if (options.onError === 'warn')
    {
      console.warn(
        `⚠️  Warning: ${error instanceof Error ? error.message : error}\n`,
      );
    }
    else if (options.onError === 'continue')
    {
      console.log('✓ Continued (error ignored)\n');
    }
    else
    {
      throw error;
    }
  }
}

/**
 A Script encapsulates steps, validations, and banners for a scripted workflow.

 The Script class provides an ergonomic DSL for building TypeScript scripts that:
 1. Accumulate steps (commands or functions) to execute
 2. Support validation checks that run before execution
 3. Display banners for visual organization
 4. Execute all steps with dry-run and confirmation support

 For convenience, a global default Script instance is provided via the module-level functions (`add`, `banner`, `execute`, etc.). For isolated instances (e.g., in tests or for conditional script selection), use `createScript()`.

 @example
 ```ts
 // Using the global default instance (most common)
 import { add, banner, execute, requireYes } from '@axhxrx/script';

 banner('🔐 Authenticate with Google...');
 add('gcloud auth login').interactive().onError('warn');

 banner('🚀 Deploying to production...');
 add('scripts/deploy prod')
   .confirm('Are you sure you want to deploy to production?', false)
   .canSkip(false);

 requireYes('Have you started the local environment?');
 await execute({ dryRun: process.argv.includes('--dry-run') });
 ```

 @example
 ```ts
 // Using explicit Script instances (for testing or advanced use)
 import { createScript } from '@axhxrx/script';

 const script = createScript();
 script.add('npm run build');
 script.add('npm run deploy');
 await script.execute({ yes: true });
 ```
 */
export class Script
{
  private steps: Step[] = [];
  private validations: Validation[] = [];
  private banners = new Map<number, string>();

  /**
   Add a command or function to the execution queue.

   @param commandOrFn - Shell command string or async function to execute
   @param options - Optional directly-specified step options (builder-pattern usually more convenient though)
   @returns ScriptBuilder for builder-pattern configuration

   @example
   ```ts
   // Using options object
   script.add('pnpm build', { cwd: 'services/web' });

   // Using builder-pattern
   script.add('pnpm build')
     .description('Build the frontend')
     .cwd('services/web')
     .confirm('Ready to build?');

   // Using a function for complex logic
   script.add(async () => {
     const exists = runQuiet('git rev-parse --verify feature-branch') !== '';
     if (exists) {
       run('git checkout feature-branch');
     } else {
       run('git checkout -b feature-branch');
     }
   }).description('Checkout or create feature branch');
   ```
   */
  add(commandOrFn: string | StepFn, options: StepOptions = {}): ScriptBuilder
  {
    const step: Step = typeof commandOrFn === 'string'
      ? { command: commandOrFn, options: { canSkip: true, ...options } }
      : { fn: commandOrFn, options: { canSkip: true, ...options } };
    this.steps.push(step);
    return new ScriptBuilder(step);
  }

  /**
   Add a banner that will be printed before the step at the current position.

   @param text - Banner text
   */
  banner(text: string): void
  {
    this.banners.set(this.steps.length, text);
  }

  /**
   Add a script-level validation check that runs before any steps execute. Use this for preconditions that must be met before the script can run.

   @param description - Human-readable description of what's being validated
   @param check - Function that returns true if valid, false/string/throw if invalid

   @example
   ```ts
   script.validate('Docker is running', () => {
     try {
       execSync('docker info', { stdio: 'ignore' });
       return true;
     } catch {
       return 'Docker daemon is not running. Please start Docker.';
     }
   });

   script.validate('Environment file exists', () => existsSync('.env.local'));
   ```
   */
  validate(
    description: string,
    check: () => boolean | string | Promise<boolean | string>,
  ): void
  {
    this.validations.push({ description, check });
  }

  /**
   Run all script-level validations. Returns true if all passed, false if any failed.
   */
  private async runScriptValidations(): Promise<boolean>
  {
    if (this.validations.length === 0)
    {
      return true;
    }

    console.log('\n🔍 Running validations...\n');

    let allPassed = true;

    for (const validation of this.validations)
    {
      process.stdout.write(`  ○ ${validation.description}... `);
      const result = await runValidation(validation);

      if (result.passed)
      {
        console.log('✓');
      }
      else
      {
        console.log('✗');
        if (result.error)
        {
          console.log(`    └─ ${result.error}`);
        }
        allPassed = false;
      }
    }

    console.log('');

    if (!allPassed)
    {
      console.error('❌ Validation failed. Please fix the issues above.\n');
    }

    return allPassed;
  }

  /**
   Print the accumulated plan without executing.
   */
  private printPlan(header = '📋 Execution Plan'): void
  {
    console.log(`\n${header}\n`);

    for (let i = 0; i < this.steps.length; i++)
    {
      if (this.banners.has(i))
      {
        console.log(`\n  ── ${this.banners.get(i)} ──\n`);
      }

      const step = this.steps[i];
      const desc = step.options.description || step.command || '[function step]';
      const flags: string[] = [];

      if (step.fn)
      {
        flags.push('fn');
      }
      if (step.options.interactive)
      {
        flags.push('interactive');
      }
      if (step.options.cwd)
      {
        flags.push(`cwd: ${step.options.cwd}`);
      }
      if (step.options.onError && step.options.onError !== 'fail')
      {
        flags.push(`onError: ${step.options.onError}`);
      }
      if (step.options.confirmPrompt)
      {
        const skipLabel = step.options.canSkip ? 'skippable' : 'required';
        flags.push(`confirm: ${skipLabel}`);
      }

      const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
      console.log(`  ${i + 1}. ${desc}${flagStr}`);

      if (
        step.command
        && step.options.description
        && step.options.description !== step.command
      )
      {
        console.log(`     └─ ${step.command}`);
      }
    }

    // Print any trailing banner
    if (this.banners.has(this.steps.length))
    {
      console.log(`\n  ── ${this.banners.get(this.steps.length)} ──\n`);
    }

    console.log(`\nTotal: ${this.steps.length} steps\n`);
  }

  /**
   Execute all accumulated steps.

   @param options - Execution options
   @returns Result object with execution status
   */
  async execute(options: ExecuteOptions = {}): Promise<ExecuteResult>
  {
    const result: ExecuteResult = {
      executed: false,
      stepsRun: 0,
      stepsSkipped: 0,
      aborted: false,
    };

    if (this.steps.length === 0)
    {
      console.log('\n📋 No steps to execute.\n');
      return result;
    }

    if (options.dryRun)
    {
      this.printPlan('📋 Execution Plan (dry run)');
      return result;
    }

    // Run script-level validations before showing plan or doing anything
    const validationsPassed = await this.runScriptValidations();
    if (!validationsPassed)
    {
      result.aborted = true;
      return result;
    }

    // Show plan and ask for confirmation unless --yes was passed
    if (!options.yes)
    {
      this.printPlan();
      const proceed = await ask('Proceed with execution?', true);
      if (!proceed)
      {
        console.log('\n❌ Aborted.\n');
        result.aborted = true;
        return result;
      }
    }

    result.executed = true;
    console.log(`\n🚀 Executing ${this.steps.length} steps...\n`);

    for (let i = 0; i < this.steps.length; i++)
    {
      if (this.banners.has(i))
      {
        printBanner(this.banners.get(i)!);
      }

      const step = this.steps[i];

      // Run step-level validation if present
      if (step.options.validateFn)
      {
        const desc = step.options.validateDescription || 'Step validation';
        process.stdout.write(`  🔍 ${desc}... `);
        const validationResult = await runValidation({
          description: desc,
          check: step.options.validateFn,
        });

        if (!validationResult.passed)
        {
          console.log('✗');
          if (validationResult.error)
          {
            console.log(`    └─ ${validationResult.error}`);
          }
          console.error('\n❌ Step validation failed.\n');
          result.aborted = true;
          return result;
        }
        console.log('✓');
      }

      // Check for per-step confirmation (either global confirmEach or step-specific)
      const needsConfirm = options.confirmEach || step.options.confirmPrompt;
      if (needsConfirm)
      {
        const stepDesc = step.options.description || step.command || '[function step]';
        const question = step.options.confirmPrompt || `Run: ${stepDesc}?`;
        const defaultYes = step.options.confirmDefault ?? true;
        const proceed = await ask(question, defaultYes);

        if (!proceed)
        {
          if (step.options.canSkip === false)
          {
            console.error('\n❌ Aborted (step cannot be skipped).');
            result.aborted = true;
            return result;
          }
          console.log('⏭️  Skipped.\n');
          result.stepsSkipped++;
          continue;
        }
      }

      await runStep(step);
      result.stepsRun++;
    }

    // Print any trailing banner
    if (this.banners.has(this.steps.length))
    {
      printBanner(this.banners.get(this.steps.length)!);
    }

    console.log('✅ All steps completed.\n');
    return result;
  }

  /**
   Reset all state (steps, validations, banners). Useful for testing.
   */
  reset(): void
  {
    this.steps = [];
    this.validations = [];
    this.banners.clear();
  }

  /**
   Get the current number of steps. Useful for testing.
   */
  getStepCount(): number
  {
    return this.steps.length;
  }
}

// ============================================================================
// Global default Script instance and delegating functions
// ============================================================================

/**
 The global default Script instance. All module-level functions (`add`, `banner`, `validate`, `execute`, etc.) delegate to this instance.

 For most use cases, you don't need to access this directly — just use the module-level functions. For advanced use cases (testing, conditional script selection), use `createScript()` to create isolated instances.
 */
const defaultScript = new Script();

/**
 Create a new isolated Script instance.

 Use this when you need multiple independent scripts (e.g., for testing or conditional script selection), rather than the global default instance.

 @returns A new Script instance

 @example
 ```ts
 import { createScript } from '@axhxrx/script';

 // In tests: create isolated instances
 const script = createScript();
 script.add('echo hello');
 await script.execute({ yes: true });
 // No need to call reset() — the instance is isolated

 // For conditional execution:
 const devScript = createScript();
 const prodScript = createScript();
 devScript.add('npm run dev');
 prodScript.add('npm run build && npm run deploy');
 if (isDev) await devScript.execute();
 else await prodScript.execute();
 ```
 */
export function createScript(): Script
{
  return new Script();
}

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
 Prompt the user for a yes/no answer during the planning phase.

 Note: This function is standalone (not part of Script) because it's a general-purpose utility for interactive prompting that doesn't accumulate state.

 @param question - The question to ask
 @param defaultYes - Default answer (default: true)
 @param alreadyAnswered - Optional answer to use — if supplied, doesn't prompt the user (this is intended for the CLI arg use case, where you only want to prompt the user if they have not already specified the value in a CLI arg or env var, etc.)
 @returns true if user answered yes
 */
export async function ask(
  question: string,
  defaultYes = true,
  alreadyAnswered?: boolean,
): Promise<boolean>
{
  if (typeof alreadyAnswered === 'boolean')
  {
    console.log(
      `Skipping "${question}" because answer was already provided: ${alreadyAnswered ? 'YES' : 'NO'}`,
    );
    return alreadyAnswered;
  }
  return await promptYesNo(question, defaultYes);
}

/**
 Require the user to answer yes during planning, or exit.

 Note: This function is standalone (not part of Script) because it may exit the process, which is a side effect that doesn't fit well into the Script model.

 @param question - The question to ask
 @param defaultYes - Default answer (default: true)
 */
export async function requireYes(
  question: string,
  defaultYes = true,
): Promise<void>
{
  if (!(await ask(question, defaultYes)))
  {
    console.error('\n❌ Aborted.');
    process.exit(1);
  }
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
