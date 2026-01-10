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

if (import.meta.main)
{
  console.log('-> executing ./src/script/Step.ts');
  console.log('Exported types: Step');
  console.log('<- executed ./src/script/Step.ts');
}
