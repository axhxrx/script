import { parseArgs } from 'node:util';

import { DEFAULT_DELAY_MS, DEFAULT_MAX_RETRIES } from './constants.ts';
import type { RetryCommandOptions } from './types/RetryCommandOptions.ts';

const NON_NEGATIVE_INTEGER = /^\d+$/;

export interface ParseCliResult
{
  options: RetryCommandOptions;
  command: string;
  help: boolean;
  /**
   On parse failure, a human-readable message. When present, `command` and `options` are not meaningful and the caller should print help and exit non-zero.
   */
  error?: string;
}

const optionConfig = {
  'max-retries': { type: 'string' },
  'delay-ms': { type: 'string' },
  if: { type: 'string', multiple: true },
  unless: { type: 'string', multiple: true },
  'if-exit-code': { type: 'string', multiple: true },
  'unless-exit-code': { type: 'string', multiple: true },
  'stdout-only': { type: 'boolean' },
  'stderr-only': { type: 'boolean' },
  quiet: { type: 'boolean', short: 'q' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

function parseNonNegativeInteger(rawValue: string | undefined, optionName: string): number | undefined
{
  if (rawValue === undefined)
  {
    return undefined;
  }

  if (!NON_NEGATIVE_INTEGER.test(rawValue))
  {
    throw new Error(`${optionName} must be a non-negative integer.`);
  }

  return Number.parseInt(rawValue, 10);
}

/**
 Parse one occurrence of an exit-code list option. Accepts a comma-separated string of non-negative integers. Whitespace around each entry is tolerated; empty tokens are rejected.
 */
function parseExitCodeList(rawValue: string, optionName: string): number[]
{
  const tokens = rawValue.split(',').map(t => t.trim());
  if (tokens.length === 0 || tokens.some(t => t.length === 0))
  {
    throw new Error(`${optionName} has an empty value or trailing comma.`);
  }
  return tokens.map(token =>
  {
    if (!NON_NEGATIVE_INTEGER.test(token))
    {
      throw new Error(`${optionName}: "${token}" is not a non-negative integer.`);
    }
    return Number.parseInt(token, 10);
  });
}

function parseExitCodeLists(rawValues: readonly string[] | undefined, optionName: string): number[] | undefined
{
  if (rawValues === undefined || rawValues.length === 0)
  {
    return undefined;
  }
  return rawValues.flatMap(raw => parseExitCodeList(raw, optionName));
}

export function printHelp(): void
{
  console.log(
    `Usage: retry-command [options] "<shell-command>"

Run a shell command and retry on failure. The command is a single quoted
string and is executed via the system shell, so pipelines, redirects, and
shell operators work inside it.

Options:
  --max-retries <n>      Max retry attempts after initial failure (default: ${DEFAULT_MAX_RETRIES})
  --delay-ms <n>         Delay between retries in ms (default: ${DEFAULT_DELAY_MS})
  --if <pattern>         Only retry if output contains <pattern> (repeatable)
  --unless <pattern>     Don't retry if output contains <pattern> (repeatable)
  --if-exit-code <list>  Only retry if exit code is in <list> (comma-separated; repeatable)
  --unless-exit-code <list> Don't retry if exit code is in <list> (comma-separated; repeatable)
  --stdout-only          Only scan the child's stdout for --if/--unless patterns
  --stderr-only          Only scan the child's stderr for --if/--unless patterns
  --quiet, -q            Suppress retry progress output and summaries (usage/validation errors still print)
  --json                 Emit a JSON result to stdout; live output goes to stderr
  --help, -h             Show this help

Examples:
  retry-command --max-retries 3 "pnpm build"
  retry-command --if "ECONNRESET" --unless "compilation failed" "pnpm build"
  retry-command --stderr-only --if "Unhandled 'error'" "pnpm test --shard=1/3"
  retry-command --if-exit-code 7,28 --unless-exit-code 22 "curl -sSf https://example.com"
`,
  );
}

export function parseCli(argv: readonly string[]): ParseCliResult
{
  try
  {
    const { values, positionals } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      options: optionConfig,
    });

    if (values.help)
    {
      return { options: {}, command: '', help: true };
    }

    if (positionals.length === 0)
    {
      return { options: {}, command: '', help: false, error: 'No command specified.' };
    }
    if (positionals.length > 1)
    {
      return {
        options: {},
        command: '',
        help: false,
        error:
          `Expected a single quoted command string, got ${positionals.length} positional arguments. Quote the whole command, e.g. retry-command --if foo "pnpm test --shard=1/3".`,
      };
    }

    if (values['stdout-only'] && values['stderr-only'])
    {
      return {
        options: {},
        command: '',
        help: false,
        error: '--stdout-only and --stderr-only are mutually exclusive.',
      };
    }

    const maxRetries = parseNonNegativeInteger(values['max-retries'], '--max-retries');
    const delayMs = parseNonNegativeInteger(values['delay-ms'], '--delay-ms');
    const retryExitCodes = parseExitCodeLists(values['if-exit-code'], '--if-exit-code');
    const noRetryExitCodes = parseExitCodeLists(values['unless-exit-code'], '--unless-exit-code');

    const options: RetryCommandOptions = {
      maxRetries,
      delayMs,
      ifPatterns: values.if,
      unlessPatterns: values.unless,
      retryExitCodes,
      noRetryExitCodes,
      streamSelector: values['stdout-only'] ? 'stdout' : values['stderr-only'] ? 'stderr' : 'both',
      quiet: values.quiet,
      json: values.json,
    };

    return { options, command: positionals[0] ?? '', help: false };
  }
  catch (error: unknown)
  {
    return {
      options: {},
      command: '',
      help: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
