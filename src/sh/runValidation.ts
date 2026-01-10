import type { Validation } from './Validation.ts';

/**
 Result of running a validation check.
 */
export interface ValidationResult
{
  passed: boolean;
  error?: string;
}

/**
 Run a validation check and return the result.
 */
export async function runValidation(
  validation: Validation,
): Promise<ValidationResult>
{
  try
  {
    const result = await validation.check();
    if (result === true)
    {
      return { passed: true };
    }
    else if (result === false)
    {
      return { passed: false };
    }
    else
    {
      // String error message
      return { passed: false, error: result };
    }
  }
  catch (error: unknown)
  {
    return {
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
