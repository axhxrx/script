/* eslint-disable no-console */

import process from 'node:process';

import { ask } from './ask.ts';
import type { ExecuteOptions } from './ExecuteOptions.ts';
import type { ExecuteResult } from './ExecuteResult.ts';
import { parseScriptArgs } from './parseScriptArgs.ts';
import { printBanner } from './printBanner.ts';
import { runStep } from './runStep.ts';
import { runValidation } from './runValidation.ts';
import { ScriptBuilder } from './ScriptBuilder.ts';
import type { Step } from './Step.ts';
import type { StepFn } from './StepFn.ts';
import type { StepOptions } from './StepOptions.ts';
import type { Validation } from './Validation.ts';

/**
 Split a multi-line command string into individual commands.

 Handles:
 - Empty lines (skipped)
 - Comment lines starting with # (skipped)
 - Backslash line continuations (joined)
 - Leading/trailing whitespace (trimmed)

 NOTE: When using backslash continuation in template literals, remember that TypeScript/JavaScript interprets `\ ` (backslash-space) as an escape sequence that produces just a space. To get a literal backslash for continuation, use `\\` in your template literal. This is a subtle bug that's easy to introduce and hard to notice.
 */
function splitCommandLines(input: string): string[]
{
  const lines = input.split('\n');
  const commands: string[] = [];
  let continuation = '';

  for (const rawLine of lines)
  {
    const line = rawLine.trim();

    // Skip empty lines and comment-only lines
    if (line === '' || line.startsWith('#'))
    {
      continue;
    }

    // Handle backslash continuation
    if (line.endsWith('\\'))
    {
      continuation += line.slice(0, -1) + ' ';
      continue;
    }

    // Complete command (with any accumulated continuation)
    commands.push(continuation + line);
    continuation = '';
  }

  // Handle trailing continuation (edge case - treat as complete)
  if (continuation)
  {
    commands.push(continuation.trim());
  }

  return commands;
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
  /**
   The global default Script instance. All module-level functions (`add`, `banner`, `validate`, `execute`, etc.) delegate to this instance.

   For most use cases, you don't need to access this directly — just use the module-level functions. For advanced use cases (testing, conditional script selection), you can create your own instances of `Script`.
   */
  static #default: Script | undefined;

  static get default(): Script
  {
    if (!this.#default)
    {
      this.#default = new Script();
    }
    return this.#default;
  }

  #steps: Step[] = [];
  #validations: Validation[] = [];
  #banners = new Map<number, string>();

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
    if (typeof commandOrFn === 'string')
    {
      // If multiLine option is set, treat as single command (original behavior)
      if (options.multiLine)
      {
        const step: Step = {
          command: commandOrFn,
          options: { canSkip: true, ...options },
        };
        this.#steps.push(step);
        return new ScriptBuilder(step);
      }

      // Default: split multi-line strings into separate steps
      const commands = splitCommandLines(commandOrFn);
      if (commands.length === 0)
      {
        // Empty or comment-only input - return builder with empty array
        return new ScriptBuilder([]);
      }
      const steps: Step[] = commands.map(cmd => ({
        command: cmd,
        options: { canSkip: true, ...options },
      }));
      this.#steps.push(...steps);
      return new ScriptBuilder(steps);
    }

    // Function step - single step as before
    const step: Step = { fn: commandOrFn, options: { canSkip: true, ...options } };
    this.#steps.push(step);
    return new ScriptBuilder(step);
  }

  /**
   Add a banner that will be printed before the step at the current position.

   @param text - Banner text
   */
  banner(text: string): void
  {
    this.#banners.set(this.#steps.length, text);
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
    this.#validations.push({ description, check });
  }

  /**
   Run all script-level validations. Returns true if all passed, false if any failed.
   */
  async #runScriptValidations(): Promise<boolean>
  {
    if (this.#validations.length === 0)
    {
      return true;
    }

    console.log('\n🔍 Running validations...\n');

    let allPassed = true;

    for (const validation of this.#validations)
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
  #printPlan(header = '📋 Execution Plan'): void
  {
    console.log(`\n${header}\n`);

    for (let i = 0; i < this.#steps.length; i++)
    {
      if (this.#banners.has(i))
      {
        console.log(`\n  ── ${this.#banners.get(i)} ──\n`);
      }

      const step = this.#steps[i];
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
    if (this.#banners.has(this.#steps.length))
    {
      console.log(`\n  ── ${this.#banners.get(this.#steps.length)} ──\n`);
    }

    console.log(`\nTotal: ${this.#steps.length} steps\n`);
  }

  /**
   Execute all accumulated steps.

   @param options - Execution options
   @returns Result object with execution status
   */
  async execute(options: ExecuteOptions = {}): Promise<ExecuteResult>
  {
    // Merge parsed args with explicit options (explicit options always win)
    let dryRun = options.dryRun;
    let yes = options.yes;

    if (options.parseArgs)
    {
      const parsed = parseScriptArgs();
      dryRun = options.dryRun ?? parsed.dryRun;
      yes = options.yes ?? parsed.yes;
    }

    const result: ExecuteResult = {
      executed: false,
      stepsRun: 0,
      stepsSkipped: 0,
      aborted: false,
    };

    if (this.#steps.length === 0)
    {
      console.log('\n📋 No steps to execute.\n');
      return result;
    }

    if (dryRun)
    {
      this.#printPlan('📋 Execution Plan (dry run)');
      return result;
    }

    // Run script-level validations before showing plan or doing anything
    const validationsPassed = await this.#runScriptValidations();
    if (!validationsPassed)
    {
      result.aborted = true;
      return result;
    }

    // Show plan and ask for confirmation unless --yes was passed
    if (!yes)
    {
      this.#printPlan();
      const proceed = await ask('Proceed with execution?', true);
      if (!proceed)
      {
        console.log('\n❌ Aborted.\n');
        result.aborted = true;
        return result;
      }
    }

    console.log(`\n🚀 Executing ${this.#steps.length} steps...\n`);

    for (let i = 0; i < this.#steps.length; i++)
    {
      if (this.#banners.has(i))
      {
        printBanner(this.#banners.get(i)!);
      }

      const step = this.#steps[i];

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

      try
      {
        await runStep(step);
        result.stepsRun++;
        result.executed = true; // Only true after at least one step completes
      }
      catch (error: unknown)
      {
        // Capture the error so callers can inspect it while still having access to partial results
        result.error = error instanceof Error ? error : new Error(String(error));
        result.aborted = true;
        return result;
      }
    }

    // Print any trailing banner
    if (this.#banners.has(this.#steps.length))
    {
      printBanner(this.#banners.get(this.#steps.length)!);
    }

    console.log('✅ All steps completed.\n');
    return result;
  }

  /**
   Reset all state (steps, validations, banners). Useful for testing.
   */
  reset(): void
  {
    this.#steps = [];
    this.#validations = [];
    this.#banners.clear();
  }

  /**
   Get the current number of steps. Useful for testing.
   */
  getStepCount(): number
  {
    return this.#steps.length;
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/Script.ts');

  // Exercise the class
  const script = new Script();
  script.banner('Self-test banner');
  script.add('echo "Script class test"');
  console.log('Script created with', script.getStepCount(), 'step(s)');

  console.log('<- executed ./src/script/Script.ts');
}
