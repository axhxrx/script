import type { StepResult } from './StepResult.ts';

/**
 Deprecated compatibility alias for the final execution state.

 @deprecated Use ExecuteResult.status instead. Legacy mapping: `success` and `dry-run` map to `complete`; `failed` and `aborted` map to `failed`.
 */
export type ScriptState = 'planning' | 'executing' | 'failed' | 'complete';

/**
 The final outcome of a Script execution.
 */
export type ExecuteStatus = 'success' | 'failed' | 'aborted' | 'dry-run';

/**
 A nonfatal execution warning produced by a step with `onError: 'warn'` or `onError: 'continue'`.
 */
export interface ExecuteWarning
{
  /**
   The index of the top-level planned step that produced the warning.
   */
  stepIndex: number;

  /**
   The description displayed for the concrete step that produced the warning.
   */
  description: string;

  /**
   Human-readable diagnostic for the warning.
   */
  message: string;

  /**
   Exit code from command or function execution, when one was available.
   */
  exitCode?: number;
}

/**
 Result returned from executing a Script.
 */
export interface ExecuteResult
{
  /**
   Canonical final execution outcome.
   */
  status: ExecuteStatus;

  /**
   Whether any steps were actually executed (at least one step completed).
   */
  executed: boolean;

  /**
   Number of top-level planned steps that ran to a non-skipped result without aborting the loop. Steps with nonfatal warnings are included here; inspect `stepsWarned` and `warnings` to detect those partial failures.
   */
  stepsRun: number;

  /**
   Total number of concrete steps that actually executed, including chained `AND`/`OR` steps recorded in `chainResults`.
   */
  totalStepsRun: number;

  /**
   Number of steps that were skipped.
   */
  stepsSkipped: number;

  /**
   Number of concrete steps that ended with an error result.
   */
  stepsFailed: number;

  /**
   Number of concrete steps that produced nonfatal warnings handled by `onError: 'warn'` or `onError: 'continue'`.
   */
  stepsWarned: number;

  /**
   Nonfatal failures that were handled by `onError: 'warn'` or  `onError: 'continue'`.
   */
  warnings: ExecuteWarning[];

  /**
   Whether execution was stopped early (user cancellation, validation failure, or step error with onError: 'fail').
   */
  aborted: boolean;

  /**
   If a step threw an error (onError: 'fail'), the error is captured here. This allows callers to inspect the error while still having access to partial execution results (stepsRun, stepsSkipped, etc.).
   */
  error?: Error;

  /**
   Deprecated compatibility alias for the final execution outcome. Legacy  mapping: `success` and `dry-run` map to `complete`; `failed` and `aborted` map to `failed`.

   @deprecated Use ExecuteResult.status instead.
   */
  state: ScriptState;

  /**
   Results from each step that was executed or skipped. Steps that weren't reached due to early termination are not included.
   */
  stepResults: StepResult[];

  /**
   Total duration of execution in milliseconds. Measured from start of first step to completion/failure.
   */
  totalDurationMs?: number;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/ExecuteResult.ts');
  console.log('Exported types: ExecuteResult, ExecuteStatus, ExecuteWarning, ScriptState');
  console.log('<- executed ./src/script/ExecuteResult.ts');
}
