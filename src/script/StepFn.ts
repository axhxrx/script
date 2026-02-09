/**
 A step function that can be executed instead of a shell command.

 Returns:
 - void: success
 - boolean: true for success, false for failure
 - number: exit code (0 for success, non-zero for failure)
 */
export type StepFn = () => void | boolean | number | Promise<void | boolean | number>;

if (import.meta.main)
{
  console.log('-> executing ./src/script/StepFn.ts');
  console.log('StepFn type exported (type-only module)');
  console.log('<- executed ./src/script/StepFn.ts');
}
