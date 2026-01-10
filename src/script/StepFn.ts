/**
 A step function that can be executed instead of a shell command.
 */
export type StepFn = () => void | Promise<void>;

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepFn.ts');
  console.log('StepFn type exported (type-only module)');
  console.log('<- executed ./src/script/StepFn.ts');
}
