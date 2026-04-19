#!/usr/bin/env bun

import process from 'node:process';

import { parseCli, printHelp } from '../src/retry-command/parseCli.ts';
import { retryCommand } from '../src/retry-command/retryCommand.ts';

async function main(): Promise<number>
{
  const argv = process.argv.slice(2);
  const parsed = parseCli(argv);

  if (parsed.help)
  {
    printHelp();
    return 0;
  }

  if (parsed.error !== undefined)
  {
    console.error(`[retry-command] ${parsed.error}`);
    console.error('Use --help for usage information.');
    return 1;
  }

  try
  {
    return await retryCommand(parsed.command, parsed.options);
  }
  catch (error: unknown)
  {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[retry-command] ${message}`);
    return 1;
  }
}

if (import.meta.main)
{
  const code = await main();
  process.exit(code);
}
