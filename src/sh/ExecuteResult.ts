/**
 Result returned from executing a Script.
 */
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
