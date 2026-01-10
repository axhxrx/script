/* eslint-disable no-console */

import process from 'node:process';

import { ask } from './ask.ts';

/**
 Require the user to answer yes during planning, or exit.

 Note: This function is standalone (not part of Script) because it may exit the process, which is a side effect that doesn't fit well into the Script model.

 @param question - The question to ask
 @param defaultYes - Default answer (default: true)
 */
export async function requireYes(
  question: string,
  defaultYes = true,
): Promise<void>
{
  if (!(await ask(question, defaultYes)))
  {
    console.error('\n❌ Aborted.');
    process.exit(1);
  }
}
