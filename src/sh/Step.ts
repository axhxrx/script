import type { StepFn } from './StepFn.ts';
import type { StepOptions } from './StepOptions.ts';

/**
 Internal representation of a step in the script.
 */
export interface Step
{
  command?: string;
  fn?: StepFn;
  options: StepOptions;
}
