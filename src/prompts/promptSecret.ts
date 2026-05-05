import process, { stdin as input, stdout as output } from 'node:process';

/**
 Prompt the user for a secret value (password, token, etc.) without
 echoing the input to the terminal.

 Designed so the value never ends up in:

 - argv (so the caller must not invoke this from a shell flag — read at exec time only)
 - shell history
 - the `@axhxrx/script` auto-log: this function deliberately does NOT
   accept a `mirrorOutput` callback, and the entered characters are
   never written to stdout (only the optional mask character is)
 - a shell command string: callers should pipe the result via stdin
   (`spawnSync('chpasswd', { input: ... })`), never embed it in a
   command string passed to `add(...)` or `execSync`

 By default each keystroke is echoed as `*` for visual feedback. Pass
 `mask: false` for fully silent input (sudo-style), or `mask: ' '` for
 indistinguishable.

 Requires an interactive TTY. Throws if `process.stdin.isTTY` is false
 — call sites should validate that up front rather than catching this
 at execute time.

 @param prompt - Prompt message. Printed verbatim — include trailing space if you want one.
 @param options.mask - Character echoed per keystroke. Default `'*'`. `false` = no echo.
 @returns The entered secret. May be empty (caller's responsibility to enforce length).
 */
export async function promptSecret(
  prompt: string,
  options: { mask?: string | false } = {},
): Promise<string>
{
  if (!input.isTTY)
  {
    throw new Error('promptSecret requires an interactive TTY');
  }
  const mask = options.mask === false ? '' : (options.mask ?? '*');

  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');

  const chars: string[] = [];

  return new Promise<string>((resolve, reject) =>
  {
    const cleanup = (): void =>
    {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
    };

    const onData = (chunk: string): void =>
    {
      for (const key of chunk)
      {
        // Ctrl-C (ETX, 0x03) — cancel
        if (key === '')
        {
          cleanup();
          output.write('\n');
          reject(new Error('Cancelled by user (Ctrl-C)'));
          return;
        }
        // Enter (CR or LF) — finalize input
        if (key === '\r' || key === '\n')
        {
          cleanup();
          output.write('\n');
          resolve(chars.join(''));
          return;
        }
        // Backspace (DEL=0x7F) or Ctrl-H (BS=0x08) — erase last char
        if (key === '' || key === '\b')
        {
          if (chars.length > 0)
          {
            chars.pop();
            if (mask.length > 0)
            {
              output.write('\b \b');
            }
          }
          continue;
        }
        // Ignore remaining control characters (arrow keys, escape sequences, etc.)
        if (key.length === 1 && key.charCodeAt(0) < 0x20)
        {
          continue;
        }
        chars.push(key);
        output.write(mask);
      }
    };

    input.on('data', onData);
  });
}

if (import.meta.main)
{
  console.log('-> executing ./src/prompts/promptSecret.ts');

  if (process.stdin.isTTY)
  {
    console.log('TTY detected - would prompt for secret (skipping in self-test)');
  }
  else
  {
    console.log('No TTY - skipping interactive prompt');
  }

  console.log('promptSecret function exported successfully');

  console.log('<- executed ./src/prompts/promptSecret.ts');
}
