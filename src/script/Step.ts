import type { StepFn } from './StepFn.ts';
import type { StepOptions } from './StepOptions.ts';

/**
 Internal representation of a step in the script.

 A Step contains a `commands` array of shell commands and/or functions that run sequentially. If the step fails, execution falls through to `orStep` if present (like shell's `||`).

 The `commands` array is mixed: each element is either:
 - A string (shell command to execute)
 - A StepFn (TypeScript function to execute)

 All commands in the array run in sequence. If any fails, the whole step fails and `orStep` is tried.
 */
export type Step =
  | {
    commands: Array<string | StepFn>;

    options: StepOptions;

    nextStep: Step;

    nextStepType: 'and';
  }
  | {
    commands: Array<string | StepFn>;

    options: StepOptions;

    nextStep: Step;

    nextStepType: 'or';
  }
  | {
    commands: Array<string | StepFn>;

    options: StepOptions;

    nextStepType: 'none';
  };

if (import.meta.main)
{
  console.log('-> executing ./src/script/Step.ts');
  console.log('Exported types: Step');
  console.log('<- executed ./src/script/Step.ts');
}
