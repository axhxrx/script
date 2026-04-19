import type { CommandResult } from './types/CommandResult.ts';
import type { RetryCommandOptions } from './types/RetryCommandOptions.ts';
import type { RetryDecision } from './types/RetryDecision.ts';
import type { StreamSelector } from './types/StreamSelector.ts';

function matched(result: CommandResult, pattern: string, selector: StreamSelector): boolean
{
  if (selector === 'stdout')
  {
    return result.stdoutCounter.hasEverMatched(pattern);
  }
  if (selector === 'stderr')
  {
    return result.stderrCounter.hasEverMatched(pattern);
  }
  return result.stdoutCounter.hasEverMatched(pattern) || result.stderrCounter.hasEverMatched(pattern);
}

/**
 Decide whether a failed command should be retried based on its output.

 Evaluation order:

 1. `unlessPatterns`: if any match, don't retry.
 2. `ifPatterns`: if specified, at least one must match to retry.
 3. Neither specified: retry unconditionally.

 The `streamSelector` option restricts which stream(s) are checked (default: `'both'`). The same selector applies to both `if` and `unless` patterns.
 */
export function shouldRetry(result: CommandResult, options: RetryCommandOptions): RetryDecision
{
  const selector: StreamSelector = options.streamSelector ?? 'both';

  if (options.unlessPatterns)
  {
    for (const pattern of options.unlessPatterns)
    {
      if (matched(result, pattern, selector))
      {
        return {
          retry: false,
          skipReason: `output matched --unless pattern "${pattern}"`,
        };
      }
    }
  }

  if (options.ifPatterns && options.ifPatterns.length > 0)
  {
    const any = options.ifPatterns.some(p => matched(result, p, selector));
    if (!any)
    {
      return {
        retry: false,
        skipReason: 'output did not match any --if pattern',
      };
    }
  }

  return { retry: true };
}
