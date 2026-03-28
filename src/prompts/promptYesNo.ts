import process, { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

/**
 Prompt the user for a yes/no confirmation.

 @param prompt - The prompt message to display
 @param defaultYes - Whether to default to yes (true) or no (false)
 @returns true if user answered yes, false otherwise

 @example
 ```ts
 const shouldContinue = await promptYesNo('Continue?', true);
 if (!shouldContinue) {
   process.exit(1);
 }
 ```
 */
export async function promptYesNo(
  prompt: string,
  defaultYes = true,
  mirrorOutput?: (text: string) => void,
): Promise<boolean>
{
  const rl = readline.createInterface({ input, output });
  try
  {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const fullPrompt = `${prompt} ${suffix}: `;
    mirrorOutput?.(fullPrompt);
    const answer = await rl.question(fullPrompt);
    mirrorOutput?.(`${answer}\n`);

    if (!answer.trim())
    {
      return defaultYes;
    }
    return answer.toLowerCase().startsWith('y');
  }
  finally
  {
    rl.close();
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/prompts/promptYesNo.ts');

  // Skip interactive test if not a TTY
  if (process.stdin.isTTY)
  {
    console.log('TTY detected - would prompt yes/no (skipping in self-test)');
  }
  else
  {
    console.log('No TTY - skipping interactive prompt');
  }
  console.log('promptYesNo function exported successfully');

  console.log('<- executed ./src/prompts/promptYesNo.ts');
}
