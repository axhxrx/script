import type { StreamSelector } from './StreamSelector.ts';

/**
 Options controlling how a command is retried.

 Pattern evaluation order when the command fails:

 1. Any `unlessPatterns` match → don't retry (denylist known-fatal errors).
 2. `ifPatterns` registered → at least one must match to retry (allowlist known-transient errors).
 3. Neither specified → retry unconditionally.
 */
export interface RetryCommandOptions
{
  /**
   Max retry attempts after the initial failure. Total attempts = `maxRetries + 1`. Default: `1`.
   */
  maxRetries?: number;

  /**
   Delay between attempts in milliseconds. Default: `1000`.
   */
  delayMs?: number;

  /**
   Allowlist: if specified, the command's output must contain at least one of these substrings for a retry to occur.
   */
  ifPatterns?: readonly string[];

  /**
   Denylist: if any of these substrings appear in the command's output, no retry is attempted.
   */
  unlessPatterns?: readonly string[];

  /**
   Allowlist on the child's exit code. If specified, a retry is only attempted when the exit code is in this list. Composes with `ifPatterns`: if either allowlist is satisfied, the command is considered retry-eligible.
   */
  retryExitCodes?: readonly number[];

  /**
   Denylist on the child's exit code. If any of these exit codes is produced, no retry is attempted. Useful for short-circuiting on fatal codes (e.g. `--unless-exit-code 143` to not retry when the child was SIGTERM'd from above).
   */
  noRetryExitCodes?: readonly number[];

  /**
   Which streams to scan for `ifPatterns` / `unlessPatterns`. Default: `'both'`.
   */
  streamSelector?: StreamSelector;

  /**
   Suppress retry-command progress output during execution: startup banner, per-attempt progress, skip-retry reasons, and the final give-up summary. The child command's own stdout/stderr are not affected. Invalid-input and usage errors may still be printed. Default: `false`.
   */
  quiet?: boolean;

  /**
   Emit a single structured JSON result to stdout after the final attempt. Live child output goes to stderr in this mode so it doesn't pollute the JSON. Default: `false`.
   */
  json?: boolean;
}
