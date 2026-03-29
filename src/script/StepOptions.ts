import type { FileOptions } from './FileOptions.ts';

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
   Use interactive terminal input for commands that need user interaction (for example gcloud auth flows that open a browser).

   By default this gives the command direct terminal access. If file logging is enabled, stdin remains interactive while stdout/stderr are captured for the log.
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

  /**
   If true, treat multi-line command strings as a single shell command instead of splitting into separate steps per line.

   By default, multi-line strings passed to `add()` are split into separate steps (one per non-empty, non-comment line (except that lines ending with '\' line continuation are combined with the next line, mimicking the shell's native behavior)). ⚠️ NOTE: Don't forget that in TypeScript, template strings treat "\" as an escape character,  so it's not really recommended to use them here.

   Set this to `true` to preserve shell's native multi-line behavior.

   @example
   ```ts
   // Creates ONE step that runs as a single shell command
   add(`
     echo "line 1"
     echo "line 2"
   `, { multiLine: true });
   ```
   */
  multiLine?: boolean;

  /**
   Condition function that, if it returns true, causes the entire step chain to be skipped at execution time. This is evaluated lazily — the function runs right before the step would execute, not when `add()` is called.

   When any step in a chain (root, `.and()`, or `.or()`) has a `skipIfFn` that returns true, the entire top-level step chain is skipped.
   */
  skipIfFn?: () => boolean | Promise<boolean>;

  /**
   File logging options for this step's output.

   When set, this step's output will be written to a file in addition to (or instead of) terminal output.
   */
  fileOptions?: FileOptions;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepOptions.ts');
  console.log('StepOptions interface exported (type-only module)');
  console.log('<- executed ./src/script/StepOptions.ts');
}
