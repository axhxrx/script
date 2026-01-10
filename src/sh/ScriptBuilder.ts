import type { Step } from './Step.ts';

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
