import type { Step } from './Step.ts';

/**
 Builder for configuring individual steps with a fluent API.

 When constructed with multiple steps (from a multi-line add()), all builder methods apply to all steps.
 */
export class ScriptBuilder
{
  #steps: Step[];

  constructor(steps: Step | Step[])
  {
    this.#steps = Array.isArray(steps) ? steps : [steps];
  }

  /**
   Set a human-readable description for this step (or all steps if multi-line).
   */
  description(desc: string): this
  {
    for (const step of this.#steps)
    {
      step.options.description = desc;
    }
    return this;
  }

  /**
   Set the working directory for this step (or all steps if multi-line).
   */
  cwd(path: string): this
  {
    for (const step of this.#steps)
    {
      step.options.cwd = path;
    }
    return this;
  }

  /**
   Mark this step as interactive (uses spawnSync with stdio:inherit). Useful for commands that open browsers or need terminal interaction.
   */
  interactive(value = true): this
  {
    for (const step of this.#steps)
    {
      step.options.interactive = value;
    }
    return this;
  }

  /**
   Set additional environment variables for this step (or all steps if multi-line).
   */
  env(vars: Record<string, string>): this
  {
    for (const step of this.#steps)
    {
      step.options.env = { ...step.options.env, ...vars };
    }
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
    for (const step of this.#steps)
    {
      step.options.onError = behavior;
    }
    return this;
  }

  /**
   Add a confirmation prompt that will be shown during execution. This is different from ask() which runs during planning.

   @param question - The question to ask (default: "Run this step?")
   @param defaultYes - Default answer (default: true)
   */
  confirm(question?: string, defaultYes = true): this
  {
    for (const step of this.#steps)
    {
      step.options.confirmPrompt = question ?? 'Run this step?';
      step.options.confirmDefault = defaultYes;
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
    for (const step of this.#steps)
    {
      step.options.canSkip = value;
    }
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
    for (const step of this.#steps)
    {
      step.options.validateFn = check;
      step.options.validateDescription = description;
    }
    return this;
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/ScriptBuilder.ts');

  // Minimal exercise of the code
  const mockStep: Step = { command: 'echo test', options: {} };
  const builder = new ScriptBuilder(mockStep);
  builder.description('test').cwd('/tmp');
  console.log('ScriptBuilder created and configured successfully');

  console.log('<- executed ./src/script/ScriptBuilder.ts');
}
