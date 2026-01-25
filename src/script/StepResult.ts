/**
 The type of step that was executed.
 */
export type StepType = 'command' | 'function' | 'interactive';

/**
 The outcome status of a step execution.
 */
export type StepStatus = 'success' | 'error' | 'warning' | 'skipped';

/**
 How a step in a chain was reached.
 - 'root': The first step in the chain (the top-level add() call)
 - 'and': Reached via .and() because the previous step succeeded
 - 'or': Reached via .or() because the previous step failed
 */
export type ChainLinkType = 'root' | 'and' | 'or';

/**
 Result of executing a single step within a chain.

 Similar to StepResult but tracks the chain link type instead of index.
 */
export interface ChainStepResult
{
  /**
   How this step was reached in the chain.
   */
  linkType: ChainLinkType;

  /**
   Type of step that was executed.
   */
  type: StepType;

  /**
   The description displayed for this step.
   */
  description: string;

  /**
   The raw command strings that were executed (excludes functions). Empty for function-only steps.
   */
  commands?: string[];

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
   */
  exitCode?: number;

  /**
   Captured stdout output. Only present for non-interactive command steps when capture is enabled.
   */
  stdout?: string;

  /**
   Captured stderr output.
   */
  stderr?: string;

  /**
   Error that occurred during execution, if any.
   */
  error?: Error;
}

/**
 Result of executing a single step (and its chain if any).
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
   The raw command strings that were executed (excludes functions). Empty for function-only steps.
   */
  commands?: string[];

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

  /**
   Results from each step in the chain (including the root step).

   This captures the full execution path through and/or chains. Each entry shows what step was executed, how it was reached (root/and/or), and its result.
   */
  chainResults?: ChainStepResult[];
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepResult.ts');
  console.log('Exported types: StepType, StepStatus, StepResult');
  console.log('<- executed ./src/script/StepResult.ts');
}
