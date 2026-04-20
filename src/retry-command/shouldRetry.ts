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
 Decide whether a failed command should be retried based on its exit code and output.

 Evaluation order (first match wins):

 1. `noRetryExitCodes` contains the exit code → don't retry.
 2. `unlessPatterns` matches the output → don't retry.
 3. Any whitelist is present (`retryExitCodes` and/or `ifPatterns`): retry only if at least one whitelist is satisfied. The two whitelists are OR'd, so a hit on either is enough.
 4. No whitelist is present → retry unconditionally.

 The `streamSelector` option restricts which stream(s) are checked for `ifPatterns` / `unlessPatterns` (default: `'both'`). It does not affect exit-code rules.
 */
export function shouldRetry(result: CommandResult, options: RetryCommandOptions): RetryDecision
{
  const selector: StreamSelector = options.streamSelector ?? 'both';

  if (options.noRetryExitCodes && options.noRetryExitCodes.includes(result.exitCode))
  {
    return {
      retry: false,
      skipReason: `exit code ${result.exitCode} matched --unless-exit-code`,
    };
  }

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

  const exitWhitelist = options.retryExitCodes && options.retryExitCodes.length > 0
    ? options.retryExitCodes
    : undefined;
  const patternWhitelist = options.ifPatterns && options.ifPatterns.length > 0 ? options.ifPatterns : undefined;

  if (exitWhitelist || patternWhitelist)
  {
    const exitOK = exitWhitelist !== undefined && exitWhitelist.includes(result.exitCode);
    const patternOK = patternWhitelist !== undefined && patternWhitelist.some(p => matched(result, p, selector));

    if (!exitOK && !patternOK)
    {
      return {
        retry: false,
        skipReason: 'no whitelist condition matched (--if-exit-code / --if)',
      };
    }
  }

  return { retry: true };
}
