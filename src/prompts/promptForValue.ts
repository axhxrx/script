import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

/**
 Prompt the user for a text value.

 @param prompt - The prompt message to display
 @param defaultValue - Optional default value if user presses Enter
 @returns The user's input (trimmed), or default value if provided and user pressed Enter

 @example
 ```ts
 const name = await promptForValue('Enter your name');
 ```

 @example
 ```ts
 const email = await promptForValue('Enter email', 'user@example.com');
 ```
 */
export async function promptForValue(
  prompt: string,
  defaultValue?: string,
): Promise<string> {
  const rl = readline.createInterface({ input, output });

  const fullPrompt = defaultValue
    ? `${prompt} [${defaultValue}]: `
    : `${prompt}: `;

  const answer = await rl.question(fullPrompt);
  rl.close();

  return answer.trim() || defaultValue || '';
}
