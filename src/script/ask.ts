/* eslint-disable no-console */

import process from 'node:process';

import { promptYesNo } from '../prompts/index.ts';

/**
 Prompt the user for a yes/no answer during the planning phase.

 Note: This function is standalone (not part of Script) because it's a general-purpose utility for interactive prompting that doesn't accumulate state.

 @param question - The question to ask
 @param defaultYes - Default answer (default: true)
 @param alreadyAnswered - Optional answer to use — if supplied, doesn't prompt the user (this is intended for the CLI arg use case, where you only want to prompt the user if they have not already specified the value in a CLI arg or env var, etc.)
 @returns true if user answered yes
 */
export async function ask(
  question: string,
  defaultYes = true,
  alreadyAnswered?: boolean,
): Promise<boolean>
{
  if (typeof alreadyAnswered === 'boolean')
  {
    console.log(
      `Skipping "${question}" because answer was already provided: ${alreadyAnswered ? 'YES' : 'NO'}`,
    );
    return alreadyAnswered;
  }
  return await promptYesNo(question, defaultYes);
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/ask.ts');

  if (process.stdin.isTTY)
  {
    console.log('TTY detected - would prompt (skipping in self-test)');
  }
  else
  {
    console.log('Skipping interactive test (not a TTY)');
  }
  console.log('ask function exported successfully');

  console.log('<- executed ./src/script/ask.ts');
}
