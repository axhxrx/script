import type { StepResult } from './StepResult.ts';

/**
 The current state of the Script execution lifecycle.
 */
export type ScriptState = 'planning' | 'executing' | 'failed' | 'complete';

/**
 Result returned from executing a Script.
 */
export interface ExecuteResult
{
  /**
   Whether any steps were actually executed (at least one step completed).
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
   Whether execution was stopped early (user cancellation, validation failure, or step error with onError: 'fail').
   */
  aborted: boolean;

  /**
   If a step threw an error (onError: 'fail'), the error is captured here. This allows callers to inspect the error while still having access to partial execution results (stepsRun, stepsSkipped, etc.).
   */
  error?: Error;

  /**
   The final state of the script execution.
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
  console.log('Exported types: ExecuteResult');
  console.log('<- executed ./src/script/ExecuteResult.ts');
}
