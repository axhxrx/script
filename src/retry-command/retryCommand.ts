import { DEFAULT_DELAY_MS, DEFAULT_MAX_RETRIES } from './constants.ts';
import { runCommand } from './runCommand.ts';
import { shouldRetry } from './shouldRetry.ts';
import type { CommandResult } from './types/CommandResult.ts';
import type { RetryCommandOptions } from './types/RetryCommandOptions.ts';

function sleep(ms: number): Promise<void>
{
  return new Promise(resolve => setTimeout(resolve, ms));
}

function allPatterns(options: RetryCommandOptions): string[]
{
  return [...(options.ifPatterns ?? []), ...(options.unlessPatterns ?? [])];
}

function resultSummary(result: CommandResult): Record<string, unknown>
{
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    attempt: result.attempt,
    durationMs: result.durationMs,
  };
}

/**
 Run a shell command, retrying on failure subject to the supplied options.

 Returns the exit code of the final attempt. Zero indicates success; non-zero indicates either command failure or a retry-skip decision.

 The command is executed via the system shell, so pipelines and shell operators inside the string behave as expected.
 */
export async function retryCommand(command: string, options: RetryCommandOptions = {}): Promise<number>
{
  const log = options.json ? console.error : console.log;

  if (!command || command.trim().length === 0)
  {
    console.error('[retry-command] Error: command must be a non-empty string.');
    return 1;
  }

  if (options.maxRetries !== undefined && (!Number.isInteger(options.maxRetries) || options.maxRetries < 0))
  {
    console.error('[retry-command] Error: maxRetries must be a non-negative integer.');
    return 1;
  }

  if (options.delayMs !== undefined && (!Number.isInteger(options.delayMs) || options.delayMs < 0))
  {
    console.error('[retry-command] Error: delayMs must be a non-negative integer.');
    return 1;
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const totalAttempts = maxRetries + 1;
  const patterns = allPatterns(options);
  const echoOutputMode = options.json ? 'stderr' : 'inherit';

  const chatty = !options.quiet;

  if (chatty)
  {
    log(`[retry-command] command: ${command}`);
    log(`[retry-command] max retries: ${maxRetries}, delay: ${delayMs}ms`);
  }

  let lastResult: CommandResult | undefined;

  for (let attempt = 1; attempt <= totalAttempts; attempt++)
  {
    if (chatty && attempt > 1)
    {
      log(`\n[retry-command] attempt ${attempt}/${totalAttempts}...`);
    }

    const result = await runCommand(command, { patterns, echoOutputMode });
    result.attempt = attempt;
    lastResult = result;

    if (result.exitCode === 0)
    {
      if (chatty)
      {
        log(`\n[retry-command] succeeded on attempt ${attempt} (${result.durationMs}ms)`);
      }
      if (options.json)
      {
        console.log(JSON.stringify({ success: true, ...resultSummary(result) }, null, 2));
      }
      return result.exitCode;
    }

    const retriesRemaining = totalAttempts - attempt;
    if (retriesRemaining === 0)
    {
      break;
    }

    const decision = shouldRetry(result, options);
    if (decision.retry)
    {
      if (chatty)
      {
        const sig = result.signal ? `, signal ${result.signal}` : '';
        const word = retriesRemaining === 1 ? 'retry' : 'retries';
        log(
          `\n[retry-command] attempt ${attempt} failed (exit ${result.exitCode}${sig}, ${result.durationMs}ms). `
            + `Retrying in ${delayMs}ms... (${retriesRemaining} ${word} remaining)`,
        );
      }
      await sleep(delayMs);
    }
    else
    {
      if (chatty && decision.skipReason)
      {
        log(`\n[retry-command] Skipping retry: ${decision.skipReason}`);
      }
      break;
    }
  }

  if (!lastResult)
  {
    return 1;
  }

  if (chatty)
  {
    log(`\n[retry-command] giving up after ${lastResult.attempt} attempt(s).`);
  }
  if (options.json)
  {
    console.log(JSON.stringify({ success: false, ...resultSummary(lastResult) }, null, 2));
  }

  return lastResult.exitCode;
}
