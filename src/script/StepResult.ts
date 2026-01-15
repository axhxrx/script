/**
 The type of step that was executed.
 */
export type StepType = 'command' | 'function' | 'interactive';

/**
 The outcome status of a step execution.
 */
export type StepStatus = 'success' | 'error' | 'warning' | 'skipped';

/**
 Result of executing a single step.
 */
export interface StepResult
{
  /**
   The index of this step in the script (0-based).
   */
  index: number;

  /**
   Type of step that was executed.
   */
  type: StepType;

  /**
   The description displayed for this step.
   */
  description: string;

  /**
   The raw command string, if this was a command step.
   */
  command?: string;

  /**
   Status of the step execution.
   */
  status: StepStatus;

  /**
   When the step started executing.
   */
  startedAt: Date;

  /**
   When the step finished executing.
   */
  finishedAt: Date;

  /**
   Duration in milliseconds.
   */
  durationMs: number;

  /**
   Exit code from command execution. Only present for command steps.
   undefined for function steps (no exit code concept).
   */
  exitCode?: number;

  /**
   Captured stdout output. Only present for non-interactive command steps when capture is enabled (default).
   */
  stdout?: string;

  /**
   Captured stderr output. Same caveats as stdout.
   */
  stderr?: string;

  /**
   Error that occurred during execution, if any.
   */
  error?: Error;

  /**
   Additional context for why a step was skipped.
   */
  skipReason?: string;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepResult.ts');
  console.log('Exported types: StepType, StepStatus, StepResult');
  console.log('<- executed ./src/script/StepResult.ts');
}
