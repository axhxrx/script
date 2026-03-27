import type { FileOptions } from './FileOptions.ts';
import { normalizeFileOptions } from './FileOptions.ts';
import { splitCommandLines } from './splitCommandLines.ts';
import type { Step } from './Step.ts';
import type { StepFn } from './StepFn.ts';

/**
 Builder for configuring individual steps with a fluent API.

 The `.or()` method creates a fallback step (like shell's `||`), and `.and()` creates a continuation step (like shell's `&&`). Both return a new builder for the created step.

 @example
 ```ts
 add("git push -u origin main")
   .description("Push to GitHub")
   .cwd(pathToNewRepo)
   .or(`
     ~/bin/update_ssh_auth_keys.ts
     git push -u origin main
   `)
   .cwd(pathToNewRepo)
   .or(() => console.log("trying..."))
     .and(`gh auth switch`)
     .and(`git push -u origin main`);
 ```
 */
export class StepBuilder
{
  #step: Step;

  constructor(step: Step)
  {
    this.#step = step;
  }

  /**
   Set a human-readable description for this step.
   */
  description(desc: string): this
  {
    this.#step.options.description = desc;
    return this;
  }

  /**
   Set the working directory for this step.
   */
  cwd(path: string): this
  {
    this.#step.options.cwd = path;
    return this;
  }

  /**
   Mark this step as interactive. By default this gives the command direct terminal access. If file logging is enabled, stdin remains interactive while stdout/stderr are captured for the log.
   */
  interactive(value = true): this
  {
    this.#step.options.interactive = value;
    return this;
  }

  /**
   Set additional environment variables for this step.
   */
  env(vars: Record<string, string>): this
  {
    this.#step.options.env = { ...this.#step.options.env, ...vars };
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
    this.#step.options.onError = behavior;
    return this;
  }

  /**
   Add a confirmation prompt that will be shown during execution. This is different from ask() which runs during planning.

   @param question - The question to ask (default: "Run this step?")
   @param defaultYes - Default answer (default: true)
   */
  confirm(question?: string, defaultYes = true): this
  {
    this.#step.options.confirmPrompt = question ?? 'Run this step?';
    this.#step.options.confirmDefault = defaultYes;
    return this;
  }

  /**
   Only if `condition` is truthy, add a confirmation prompt that will be shown during execution. This is different from ask() which runs during planning.

   @param condition - If true, add a confirmation prompt
   @param question - The question to ask (default: "Run this step?")
   @param defaultYes - Default answer (default: true)
   */
  confirmIf(condition: boolean, question?: string, defaultYes = true): this
  {
    if (condition)
    {
      this.confirm(question, defaultYes);
    }
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
    this.#step.options.canSkip = value;
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
    this.#step.options.validateFn = check;
    this.#step.options.validateDescription = description;
    return this;
  }

  /**
   Configure file logging for this step's output.

   @param options - File path, boolean, or full FileOptions object
   @returns this for chaining

   @example
   ```ts
   // Log to temp file (prints path with tail hint)
   add("npm test").file()

   // Log to specific path in append mode
   add("npm test").file('./test.log')

   // Full options
   add("npm test").file({
     path: './logs/test.log',
     mode: 'increment',
     output: 'command',
     redact: 'auto',
     timestamps: true,
     stderr: 'prefixed'
   })
   ```
   */
  file(options?: string | boolean | FileOptions): this
  {
    this.#step.options.fileOptions = normalizeFileOptions(options ?? true);
    return this;
  }

  /**
   Create a continuation step that runs if this step succeeds. Like shell's `&&` operator.

   Returns a new StepBuilder for configuring the continuation step. The new step has its own cwd, env, description, etc.

   @param cmdOrFn - Shell command string (can be multi-line) or function for the continuation
   @returns StepBuilder for the continuation step

   @example
   ```ts
   add("npm install")
     .and("npm run build")
       .cwd("./dist")
     .and("npm test");
   ```
   */
  and(cmdOrFn: string | StepFn): StepBuilder
  {
    // Create the continuation step
    const andStep: Step = {
      commands: [],
      options: {},
      nextStepType: 'none',
    };

    // Parse the command/function using shared helper (handles backslash continuations, comments, etc.)
    if (typeof cmdOrFn === 'string')
    {
      andStep.commands = splitCommandLines(cmdOrFn);
    }
    else
    {
      andStep.commands.push(cmdOrFn);
    }

    // HACK: Step is a discriminated union (and|or|none) so that downstream consumers get
    // exhaustive narrowing when they switch on nextStepType — e.g. when nextStepType is
    // 'none', TypeScript proves nextStep doesn't exist, so they can't accidentally access
    // it. That's a real benefit worth preserving. But here in the builder, we need to
    // mutate a Step that was born as 'none' into 'and'. The `as` casts lie to the compiler
    // about the current shape while we fix it up. This is safe because both assignments are
    // synchronous with nothing between them, and no other code can observe the intermediate
    // state. Verified 2026-03-28: all creation sites start as 'none', all mutation sites
    // (here and in .or()) set both fields atomically, all read sites check nextStepType
    // before accessing nextStep. If you add a new variant or a new creation/mutation site,
    // re-verify this invariant.
    (this.#step as { nextStep: Step; nextStepType: 'and' }).nextStep = andStep;
    (this.#step as { nextStepType: 'and' }).nextStepType = 'and';

    // Return builder for the andStep
    return new StepBuilder(andStep);
  }

  /**
   Create a fallback step that runs if this step fails. Like shell's `||` operator.

   Returns a new StepBuilder for configuring the fallback step. The fallback step has its own cwd, env, description, etc.

   @param cmdOrFn - Shell command string (can be multi-line) or function for the fallback
   @returns StepBuilder for the fallback step

   @example
   ```ts
   add("git push -u origin main")
     .description("Push to GitHub")
     .or("~/bin/fix_ssh.sh")
       .description("Fix SSH keys")
     .or(() => console.log("giving up"));
   ```
   */
  or(cmdOrFn: string | StepFn): StepBuilder
  {
    // Create the fallback step
    const orStep: Step = {
      commands: [],
      options: {},
      nextStepType: 'none',
    };

    // Parse the command/function using shared helper (handles backslash continuations, comments, etc.)
    if (typeof cmdOrFn === 'string')
    {
      orStep.commands = splitCommandLines(cmdOrFn);
    }
    else
    {
      orStep.commands.push(cmdOrFn);
    }

    // Same discriminated-union mutation hack as in .and() — see comment there.
    (this.#step as { nextStep: Step; nextStepType: 'or' }).nextStep = orStep;
    (this.#step as { nextStepType: 'or' }).nextStepType = 'or';

    // Return builder for the orStep
    return new StepBuilder(orStep);
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepBuilder.ts');

  // Minimal exercise of the code
  const mockStep: Step = { commands: ['echo test'], options: {}, nextStepType: 'none' };
  const builder = new StepBuilder(mockStep);
  builder.description('test').cwd('/tmp');
  console.log('StepBuilder created and configured successfully');

  console.log('<- executed ./src/script/StepBuilder.ts');
}
