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

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepOptions.ts');
  console.log('StepOptions interface exported (type-only module)');
  console.log('<- executed ./src/script/StepOptions.ts');
}
