import type { StreamSelector } from './StreamSelector.ts';

/**
 Options controlling how a command is retried.

 Pattern evaluation order when the command fails:

 1. Any `unlessPatterns` match → don't retry (blacklist known-fatal errors).
 2. `ifPatterns` registered → at least one must match to retry (whitelist known-transient errors).
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
   Whitelist: if specified, the command's output must contain at least one of these substrings for a retry to occur.
   */
  ifPatterns?: readonly string[];

  /**
   Blacklist: if any of these substrings appear in the command's output, no retry is attempted.
   */
  unlessPatterns?: readonly string[];

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
