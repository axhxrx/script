/**
 A validation check that runs before execution.
 */
export interface Validation
{
  /**
   Human-readable description of what's being validated.
   */
  description: string;

  /**
   The validation function. Return true if valid, false or throw if invalid. Can also return a string error message on failure.
   */
  check: () => boolean | string | Promise<boolean | string>;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/Validation.ts');
  console.log('Exported types: Validation');
  console.log('<- executed ./src/script/Validation.ts');
}
