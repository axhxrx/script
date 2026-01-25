/* eslint-disable no-console */

import { ask } from './ask.ts';
import type { ExecuteOptions } from './ExecuteOptions.ts';
import type { ExecuteResult } from './ExecuteResult.ts';
import type { FileOptions } from './FileOptions.ts';
import { normalizeFileOptions } from './FileOptions.ts';
import { OutputContext } from './OutputContext.ts';
import { parseScriptArgs } from './parseScriptArgs.ts';
import { printBanner } from './printBanner.ts';
import { getStepDescription, isFunctionStep, runStep } from './runStep.ts';
import { runValidation } from './runValidation.ts';
import { splitCommandLines } from './splitCommandLines.ts';
import type { Step } from './Step.ts';
import { StepBuilder } from './StepBuilder.ts';
import type { StepFn } from './StepFn.ts';
import type { StepOptions } from './StepOptions.ts';
import type { ChainLinkType, ChainStepResult, StepResult } from './StepResult.ts';
import type { Validation } from './Validation.ts';

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

   For most use cases, you don't need to access this directly — just use the module-level functions. Most scripts are conceptually just a single  global script, so its simpler that way.

   For advanced use cases (testing, conditional script selection), you can create your own instances of `Script`. Or, if you are just an O.G. radguy warez kingpin kind of person, and you love you some old-timey OOP... knock yourself out.
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
  #stepResults: StepResult[] = [];
  #outputContext: OutputContext = new OutputContext(true);

  /**
   Get the results of steps executed so far. Useful for step N to inspect results of step N-1.
   */
  get stepResults(): readonly StepResult[]
  {
    return [...this.#stepResults];
  }

  /**
   Configure file logging for all script output.

   @param options - File path, boolean, or full FileOptions object
   @returns Promise that resolves to the actual file path being written to

   @example
   ```ts
   // Log to temp file (prints path with tail hint)
   await script.file();

   // Log to specific path in append mode
   await script.file('./script.log');

   // Full options
   await script.file({
     path: './logs/script.log',
     mode: 'increment',
     output: 'command',  // Only command output, no framework messages
     redact: 'auto',
     timestamps: true,
     stderr: 'prefixed'
   });
   ```
   */
  async file(options?: string | boolean | FileOptions): Promise<string | undefined>
  {
    const filePath = await this.#outputContext.setFile(normalizeFileOptions(options ?? true));

    // Print file path hint if we got a file
    if (filePath)
    {
      this.#outputContext.log(`📝 Logging to: ${filePath}`);
      this.#outputContext.log(`   (To watch: tail -f ${filePath})\n`);
    }

    return filePath;
  }

  /**
   Add a command or function to the execution queue.

   @param commandOrFn - Shell command string or async function to execute
   @param options - Optional directly-specified step options (builder-pattern usually more convenient though)
   @returns StepBuilder for builder-pattern configuration

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
  add(commandOrFn: string | StepFn, options: StepOptions = {}): StepBuilder
  {
    if (typeof commandOrFn === 'string')
    {
      // If multiLine option is set, treat as single command
      if (options.multiLine)
      {
        const step: Step = {
          commands: [commandOrFn],
          options: { canSkip: true, ...options },
          nextStepType: 'none',
        };
        this.#steps.push(step);
        return new StepBuilder(step);
      }

      // Split multi-line strings into commands array
      const commands = splitCommandLines(commandOrFn);
      if (commands.length === 0)
      {
        // Empty or comment-only input - create step with empty commands
        const step: Step = {
          commands: [],
          options: { canSkip: true, ...options },
          nextStepType: 'none',
        };
        return new StepBuilder(step);
      }

      // Create step with commands array
      const step: Step = {
        commands: commands,
        options: { canSkip: true, ...options },
        nextStepType: 'none',
      };
      this.#steps.push(step);
      return new StepBuilder(step);
    }

    // Function step - single function in commands array
    const step: Step = {
      commands: [commandOrFn],
      options: { canSkip: true, ...options },
      nextStepType: 'none',
    };
    this.#steps.push(step);
    return new StepBuilder(step);
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
    const ctx = this.#outputContext;

    if (this.#validations.length === 0)
    {
      return true;
    }

    ctx.log('\n🔍 Running validations...\n');

    let allPassed = true;

    for (const validation of this.#validations)
    {
      ctx.write(`  ○ ${validation.description}... `);
      const result = await runValidation(validation);

      if (result.passed)
      {
        ctx.log('✓');
      }
      else
      {
        ctx.log('✗');
        if (result.error)
        {
          ctx.log(`    └─ ${result.error}`);
        }
        allPassed = false;
      }
    }

    ctx.log('');

    if (!allPassed)
    {
      ctx.error('❌ Validation failed. Please fix the issues above.\n');
    }

    return allPassed;
  }

  /**
   Print the accumulated plan without executing.
   */
  #printPlan(header = '📋 Execution Plan'): void
  {
    const ctx = this.#outputContext;

    ctx.log(`\n${header}\n`);

    for (let i = 0; i < this.#steps.length; i++)
    {
      if (this.#banners.has(i))
      {
        ctx.log(`\n  ── ${this.#banners.get(i)} ──\n`);
      }

      const step = this.#steps[i];
      const desc = getStepDescription(step);
      const flags: string[] = [];

      if (isFunctionStep(step))
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
      if (step.nextStepType !== 'none')
      {
        flags.push(
          `has ${step.nextStepType === 'or' ? 'fallback' : 'continuation'}`,
        );
      }

      const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
      ctx.log(`  ${i + 1}. ${desc}${flagStr}`);

      // Show individual commands if we have a description
      if (step.options.description && step.commands.length > 0)
      {
        for (const cmd of step.commands)
        {
          if (typeof cmd === 'string')
          {
            ctx.log(`     └─ ${cmd}`);
          }
          else
          {
            ctx.log(`     └─ [function]`);
          }
        }
      }
    }

    // Print any trailing banner
    if (this.#banners.has(this.#steps.length))
    {
      ctx.log(`\n  ── ${this.#banners.get(this.#steps.length)} ──\n`);
    }

    ctx.log(`\nTotal: ${this.#steps.length} steps\n`);
  }

  /**
   Execute a step chain, following and/or links based on success/failure.

   @returns The StepResult from the final step in the chain, with chainResults populated
   */
  async #executeStepChain(
    step: Step,
    index: number,
    captureOutput: boolean,
  ): Promise<StepResult>
  {
    const ctx = this.#outputContext;
    let currentStep: Step = step;
    let lastResult: StepResult | undefined;
    let lastError: Error | undefined;

    // Track how we reached the current step
    let currentLinkType: ChainLinkType = 'root';

    // Collect results from each step in the chain
    const chainResults: ChainStepResult[] = [];

    // Default step context from ROOT step's file options
    const rootStepCtx = step.options.fileOptions
      ? await ctx.forStep(step.options.fileOptions)
      : ctx;

    while (true)
    {
      try
      {
        // If current step has its own file options, use those; otherwise use root/parent context
        const currentStepCtx = currentStep.options.fileOptions
          ? await ctx.forStep(currentStep.options.fileOptions)
          : rootStepCtx;

        lastResult = await runStep(currentStep, index, {
          captureOutput,
          outputContext: currentStepCtx,
        });

        // Record this step's result in the chain
        chainResults.push({
          linkType: currentLinkType,
          type: lastResult.type,
          description: lastResult.description,
          commands: lastResult.commands,
          status: lastResult.status,
          startedAt: lastResult.startedAt,
          finishedAt: lastResult.finishedAt,
          durationMs: lastResult.durationMs,
          exitCode: lastResult.exitCode,
          stdout: lastResult.stdout,
          stderr: lastResult.stderr,
          error: lastResult.error,
        });

        // Step succeeded - follow andStep if present
        if (currentStep.nextStepType === 'and')
        {
          const andDesc = getStepDescription(currentStep.nextStep);
          ctx.log(`↪️  AND: ${andDesc}`);
          currentStep = currentStep.nextStep;
          currentLinkType = 'and';
          continue;
        }

        // No continuation - we're done, attach chain results
        lastResult.chainResults = chainResults;
        return lastResult;
      }
      catch (err: unknown)
      {
        const errWithResult = err as Error & { stepResult?: StepResult };
        if (errWithResult.stepResult)
        {
          lastResult = errWithResult.stepResult;
        }
        else
        {
          const now = new Date();
          lastResult = {
            index,
            type: isFunctionStep(currentStep)
              ? 'function'
              : currentStep.options.interactive
              ? 'interactive'
              : 'command',
            description: getStepDescription(currentStep),
            commands: currentStep.commands.filter(
              (c): c is string => typeof c === 'string',
            ),
            status: 'error',
            startedAt: now,
            finishedAt: now,
            durationMs: 0,
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
        lastError = err instanceof Error ? err : new Error(String(err));

        // Record this step's result in the chain
        chainResults.push({
          linkType: currentLinkType,
          type: lastResult.type,
          description: lastResult.description,
          commands: lastResult.commands,
          status: lastResult.status,
          startedAt: lastResult.startedAt,
          finishedAt: lastResult.finishedAt,
          durationMs: lastResult.durationMs,
          exitCode: lastResult.exitCode,
          stdout: lastResult.stdout,
          stderr: lastResult.stderr,
          error: lastResult.error,
        });

        // Step failed - follow orStep if present
        if (currentStep.nextStepType === 'or')
        {
          const orDesc = getStepDescription(currentStep.nextStep);
          ctx.log(`\n↩️  OR: ${orDesc}`);
          currentStep = currentStep.nextStep;
          currentLinkType = 'or';
          continue;
        }

        // No fallback - throw the error
        break;
      }
    }

    // Exhausted all options - attach chain results and throw the last error
    if (lastError && lastResult)
    {
      lastResult.chainResults = chainResults;
      (lastError as Error & { stepResult?: StepResult }).stepResult = lastResult;
      throw lastError;
    }

    // Should never get here, but TypeScript needs it
    throw new Error('Unexpected: no result from step execution');
  }

  /**
   Execute all accumulated steps.

   @param options - Execution options
   @returns Result object with execution status
   */
  async execute(options: ExecuteOptions = {}): Promise<ExecuteResult>
  {
    const ctx = this.#outputContext;

    // Merge parsed args with explicit options (explicit options always win)
    let dryRun = options.dryRun;
    let yes = options.yes;

    if (options.parseArgs)
    {
      const parsed = parseScriptArgs();
      dryRun = options.dryRun ?? parsed.dryRun;
      yes = options.yes ?? parsed.yes;
    }

    const printResults = options.printResults ?? true;
    const captureOutput = options.captureOutput ?? true;

    // Reset step results for this execution
    this.#stepResults = [];

    const startTime = Date.now();

    const result: ExecuteResult = {
      executed: false,
      stepsRun: 0,
      stepsSkipped: 0,
      aborted: false,
      state: 'planning',
      stepResults: [],
    };

    if (this.#steps.length === 0)
    {
      ctx.log('\n📋 No steps to execute.\n');
      result.state = 'complete';
      return result;
    }

    if (dryRun)
    {
      this.#printPlan('📋 Execution Plan (dry run)');
      result.state = 'complete';
      return result;
    }

    // Run script-level validations before showing plan or doing anything
    const validationsPassed = await this.#runScriptValidations();
    if (!validationsPassed)
    {
      result.aborted = true;
      result.state = 'failed';
      if (printResults)
      {
        this.#printResultsSummary(result);
      }
      return result;
    }

    // Show plan and ask for confirmation unless --yes was passed
    if (!yes)
    {
      this.#printPlan();
      const proceed = await ask('Proceed with execution?', true);
      if (!proceed)
      {
        ctx.log('\n❌ Aborted.\n');
        result.aborted = true;
        result.state = 'failed';
        if (printResults)
        {
          this.#printResultsSummary(result);
        }
        return result;
      }
    }

    ctx.log(`\n🚀 Executing ${this.#steps.length} steps...\n`);

    for (let i = 0; i < this.#steps.length; i++)
    {
      if (this.#banners.has(i))
      {
        printBanner(this.#banners.get(i)!, ctx);
      }

      const step = this.#steps[i];
      const stepDesc = getStepDescription(step);

      // Run step-level validation if present
      if (step.options.validateFn)
      {
        const desc = step.options.validateDescription || 'Step validation';
        ctx.write(`  🔍 ${desc}... `);
        const validationResult = await runValidation({
          description: desc,
          check: step.options.validateFn,
        });

        if (!validationResult.passed)
        {
          ctx.log('✗');
          if (validationResult.error)
          {
            ctx.log(`    └─ ${validationResult.error}`);
          }
          ctx.error('\n❌ Step validation failed.\n');
          result.aborted = true;
          result.state = 'failed';
          result.stepResults = [...this.#stepResults];
          result.totalDurationMs = Date.now() - startTime;
          if (printResults)
          {
            this.#printResultsSummary(result);
          }
          return result;
        }
        ctx.log('✓');
      }

      // Check for per-step confirmation (either global confirmEach or step-specific)
      const needsConfirm = options.confirmEach || step.options.confirmPrompt;
      if (needsConfirm)
      {
        const question = step.options.confirmPrompt || `Run: ${stepDesc}?`;
        const defaultYes = step.options.confirmDefault ?? true;
        const proceed = await ask(question, defaultYes);

        if (!proceed)
        {
          if (step.options.canSkip === false)
          {
            ctx.error('\n❌ Aborted (step cannot be skipped).');
            result.aborted = true;
            result.state = 'failed';
            result.stepResults = [...this.#stepResults];
            result.totalDurationMs = Date.now() - startTime;
            if (printResults)
            {
              this.#printResultsSummary(result);
            }
            return result;
          }
          ctx.log('⏭️  Skipped.\n');

          // Record skipped step
          const now = new Date();
          const skipResult: StepResult = {
            index: i,
            type: isFunctionStep(step)
              ? 'function'
              : step.options.interactive
              ? 'interactive'
              : 'command',
            description: stepDesc,
            commands: step.commands.filter(
              (c): c is string => typeof c === 'string',
            ),
            status: 'skipped',
            startedAt: now,
            finishedAt: now,
            durationMs: 0,
            skipReason: 'User declined confirmation',
          };
          this.#stepResults.push(skipResult);
          result.stepsSkipped++;
          continue;
        }
      }

      try
      {
        const stepResult = await this.#executeStepChain(step, i, captureOutput);
        this.#stepResults.push(stepResult);
        result.stepsRun++;
        result.executed = true; // Only true after at least one step completes
      }
      catch (error: unknown)
      {
        // Get the step result from the error if available
        const errWithResult = error as Error & { stepResult?: StepResult };
        if (errWithResult.stepResult)
        {
          this.#stepResults.push(errWithResult.stepResult);
        }

        // Capture the error so callers can inspect it while still having access to partial results
        result.error = error instanceof Error ? error : new Error(String(error));
        result.aborted = true;
        result.state = 'failed';
        result.stepResults = [...this.#stepResults];
        result.totalDurationMs = Date.now() - startTime;
        if (printResults)
        {
          this.#printResultsSummary(result);
        }
        return result;
      }
    }

    // Print any trailing banner
    if (this.#banners.has(this.#steps.length))
    {
      printBanner(this.#banners.get(this.#steps.length)!, ctx);
    }

    result.state = 'complete';
    result.stepResults = [...this.#stepResults];
    result.totalDurationMs = Date.now() - startTime;

    ctx.log('✅ All steps completed.\n');
    if (printResults)
    {
      this.#printResultsSummary(result);
    }
    return result;
  }

  /**
   Format a duration in milliseconds for display.
   */
  #formatDuration(ms: number): string
  {
    if (ms < 1000)
    {
      return `${ms}ms`;
    }
    if (ms < 60000)
    {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   Get a status icon for a step result.
   */
  #getStatusIcon(status: string): string
  {
    switch (status)
    {
      case 'success':
        return '✓';
      case 'skipped':
        return '⏭️';
      case 'warning':
        return '⚠️';
      default:
        return '✗';
    }
  }

  /**
   Get a link type prefix for chain step display.
   */
  #getLinkPrefix(linkType: ChainLinkType): string
  {
    switch (linkType)
    {
      case 'root':
        return '';
      case 'and':
        return 'AND:  ';
      case 'or':
        return 'OR:   ';
    }
  }

  /**
   Print an execution summary.
   */
  #printResultsSummary(result: ExecuteResult): void
  {
    const ctx = this.#outputContext;

    ctx.log('\n' + '─'.repeat(60));
    ctx.log('📊 Execution Summary');
    ctx.log('─'.repeat(60));

    // Status line
    const statusEmoji = result.state === 'complete' ? '✅' : '❌';
    const statusText = result.state === 'complete' ? 'Completed' : 'Failed';
    ctx.log(`\nStatus: ${statusEmoji} ${statusText}`);

    // Count total chain steps executed
    let totalChainSteps = 0;
    let successfulChainSteps = 0;
    for (const sr of result.stepResults)
    {
      if (sr.chainResults)
      {
        totalChainSteps += sr.chainResults.length;
        successfulChainSteps += sr.chainResults.filter(c => c.status === 'success').length;
      }
      else
      {
        totalChainSteps += 1;
        if (sr.status === 'success') successfulChainSteps += 1;
      }
    }

    // Stats
    const chainInfo = result.stepResults.length !== totalChainSteps
      ? ` (${totalChainSteps} including AND/OR chained steps)`
      : '';
    const statsLine = result.stepsSkipped > 0
      ? `Steps: ${result.stepsRun} ${chainInfo}, ${result.stepsSkipped} skipped`
      : `Steps: ${result.stepsRun} ${chainInfo}`;
    ctx.log(statsLine);

    if (result.totalDurationMs !== undefined)
    {
      ctx.log(`Duration: ${this.#formatDuration(result.totalDurationMs)}`);
    }

    // Step details with chain expansion
    // Format: Left icon = overall chain result, Right icon = individual step result
    if (result.stepResults.length > 0)
    {
      ctx.log('\nStep Results:');
      for (const sr of result.stepResults)
      {
        if (sr.chainResults && sr.chainResults.length > 0)
        {
          // Show expanded chain results
          for (const chainStep of sr.chainResults)
          {
            const stepIcon = this.#getStatusIcon(chainStep.status);
            const duration = chainStep.durationMs > 0
              ? ` (${this.#formatDuration(chainStep.durationMs)})`
              : '';

            if (chainStep.linkType === 'root')
            {
              // Root step: overall chain status on left, step status on right
              const overallIcon = this.#getStatusIcon(sr.status);
              ctx.log(
                `  ${overallIcon} ${sr.index + 1}. ${chainStep.description}${duration} ${stepIcon}`,
              );
            }
            else
            {
              // Chain step: link prefix, step status on right
              const linkPrefix = this.#getLinkPrefix(chainStep.linkType);
              ctx.log(
                `       ${linkPrefix}${chainStep.description}${duration} ${stepIcon}`,
              );
            }
          }
        }
        else
        {
          // No chain results - show simple step (status on both sides, same value)
          const statusIcon = this.#getStatusIcon(sr.status);
          const duration = sr.durationMs > 0 ? ` (${this.#formatDuration(sr.durationMs)})` : '';
          ctx.log(`  ${statusIcon} ${sr.index + 1}. ${sr.description}${duration} ${statusIcon}`);
        }
      }
    }

    // Error details
    if (result.error)
    {
      ctx.log(`\nError: ${result.error.message}`);
    }

    ctx.log('');
  }

  /**
   Reset all state (steps, validations, banners). Useful for testing.
   */
  reset(): void
  {
    this.#steps = [];
    this.#validations = [];
    this.#banners.clear();
    this.#stepResults = [];
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
