import process, { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

/**
 Prompt the user to pick from a set of choices, repeating until the
 input is valid (or the user presses Ctrl-C / Ctrl-D).

 Choices accept two forms:

 1. As an object mapping single-character input keys to return values.
    Display format is `[k] value`, one per line:
    ```ts
    const mode = await promptChoice('How to configure?', {
      p: 'paste',
      g: 'generate',
    });
    // user types 'p' -> returns 'paste'
    ```

 2. As an array of labels, each containing exactly one bracketed
    character. The bracketed character is the input key; the "word"
    containing the brackets, with the brackets removed, is the
    returned value. Trailing descriptive text is shown but not
    matched against:
    ```ts
    const mode = await promptChoice('How to configure?', [
      '[p]aste an existing key',
      '[g]enerate a new one',
    ]);
    // user types 'p' -> returns 'paste'
    ```

 Input matching is case-insensitive. The user may type the single
 character key OR the full canonical word (e.g. either `p` or
 `paste`). On invalid or empty input a brief error is printed and the
 cursor returns for another attempt; the prompt does not abort.

 @param prompt - The question shown above the choice list
 @param choices - A `{ key: value }` map, or a `'[k]ey-word'` label array
 @param options.mirrorOutput - Optional callback to mirror prompt + answer into a log
 @returns The chosen value
 */
export async function promptChoice<T extends Record<string, string>>(
  prompt: string,
  choices: T,
  options?: { mirrorOutput?: (text: string) => void },
): Promise<T[keyof T]>;
export async function promptChoice(
  prompt: string,
  choices: readonly string[],
  options?: { mirrorOutput?: (text: string) => void },
): Promise<string>;
export async function promptChoice(
  prompt: string,
  choices: Record<string, string> | readonly string[],
  options: { mirrorOutput?: (text: string) => void } = {},
): Promise<string>
{
  const parsed = parseChoices(choices);
  const keys = Object.keys(parsed.map);
  const valuesLower = new Map<string, string>();
  for (const v of Object.values(parsed.map))
  {
    valuesLower.set(v.toLowerCase(), v);
  }

  const banner = `${prompt}\n${parsed.lines.join('\n')}\n`;
  output.write(banner);
  options.mirrorOutput?.(banner);

  const rl = readline.createInterface({ input, output });
  try
  {
    while (true)
    {
      const cursor = '> ';
      options.mirrorOutput?.(cursor);
      const raw = await rl.question(cursor);
      const answer = raw.trim().toLowerCase();
      options.mirrorOutput?.(`${raw}\n`);

      if (answer.length > 0)
      {
        if (Object.prototype.hasOwnProperty.call(parsed.map, answer))
        {
          return parsed.map[answer]!;
        }
        const fullMatch = valuesLower.get(answer);
        if (fullMatch !== undefined)
        {
          return fullMatch;
        }
      }

      const errMsg = `  Invalid answer ${answer.length > 0 ? `'${raw.trim()}'` : '(empty)'}. Please enter one of: ${
        keys.join(', ')
      } — or press Ctrl-C to cancel.\n`;
      output.write(errMsg);
      options.mirrorOutput?.(errMsg);
    }
  }
  finally
  {
    rl.close();
  }
}

interface ParsedChoices
{
  map: Record<string, string>;
  lines: string[];
}

function parseChoices(choices: Record<string, string> | readonly string[]): ParsedChoices
{
  if (Array.isArray(choices))
  {
    return parseArrayChoices(choices);
  }
  return parseObjectChoices(choices as Record<string, string>);
}

function parseObjectChoices(choices: Record<string, string>): ParsedChoices
{
  const entries = Object.entries(choices);
  if (entries.length === 0)
  {
    throw new Error('promptChoice: choices object is empty');
  }
  const map: Record<string, string> = {};
  const lines: string[] = [];
  for (const [key, value] of entries)
  {
    if (key.length !== 1)
    {
      throw new Error(`promptChoice: choice key '${key}' must be a single character`);
    }
    const k = key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, k))
    {
      throw new Error(`promptChoice: duplicate choice key '${k}'`);
    }
    map[k] = value;
    lines.push(`  [${key}] ${value}`);
  }
  return { map, lines };
}

function parseArrayChoices(labels: readonly string[]): ParsedChoices
{
  if (labels.length === 0)
  {
    throw new Error('promptChoice: choices array is empty');
  }
  const map: Record<string, string> = {};
  const lines: string[] = [];
  const bracketRe = /\[([^\]\s])\]/;
  for (const label of labels)
  {
    const m = bracketRe.exec(label);
    if (!m)
    {
      throw new Error(
        `promptChoice: label '${label}' has no '[X]' marker (e.g. '[p]aste an existing key')`,
      );
    }
    const key = m[1]!.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, key))
    {
      throw new Error(`promptChoice: duplicate choice key '${key}' in label '${label}'`);
    }
    // The "word" containing the bracketed letter = the contiguous non-whitespace
    // chars on either side of `[X]`, then `X` itself in place of the brackets.
    const before = label.slice(0, m.index).match(/\S*$/)?.[0] ?? '';
    const after = label.slice(m.index + m[0].length).match(/^\S*/)?.[0] ?? '';
    const value = before + m[1] + after;
    map[key] = value;
    lines.push(`  ${label}`);
  }
  return { map, lines };
}

if (import.meta.main)
{
  console.log('-> executing ./src/prompts/promptChoice.ts');

  // Non-interactive parser smoke tests.
  const arr = parseArrayChoices(['[p]aste an existing key', '[g]enerate a new one']);
  console.log('  array form  ->', JSON.stringify(arr));

  const obj = parseObjectChoices({ p: 'paste', g: 'generate' });
  console.log('  object form ->', JSON.stringify(obj));

  // Reject error cases.
  for (const bad of [[], ['nobrackets here'], ['[p]aste', '[p]ick (dup)']] as const)
  {
    try
    {
      parseArrayChoices(bad);
      console.log(`  expected throw for ${JSON.stringify(bad)} but did not`);
    }
    catch (error: unknown)
    {
      console.log(`  ok: ${(error as Error).message}`);
    }
  }

  if (process.stdin.isTTY)
  {
    console.log('TTY detected - would prompt for choice (skipping in self-test)');
  }
  else
  {
    console.log('No TTY - skipping interactive prompt');
  }

  console.log('promptChoice function exported successfully');

  console.log('<- executed ./src/prompts/promptChoice.ts');
}
