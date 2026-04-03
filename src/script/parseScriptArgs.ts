import process from 'node:process';

/**
 Parsed script arguments for common flags.
 */
export interface ParsedScriptArgs
{
  /**
   Whether --dryRun or --dry-run was passed.
   */
  dryRun: boolean;

  /**
   Whether -y or --yes was passed.
   */
  yes: boolean;

  /**
   Directory path from --auto-log-to or --autoLogTo, if specified.
   */
  autoLogTo?: string;

  /**
   All other arguments that weren't recognized as flags.
   */
  otherArgs: string[];
}

/**
 Parse common script arguments from process.argv (or a custom array).

 Recognizes:
 - `--dryRun` or `--dry-run` → `dryRun: true`
 - `-y` or `--yes` → `yes: true`
 - `--auto-log-to <dir>` or `--autoLogTo <dir>` → `autoLogTo: '<dir>'`

 All other arguments are returned in `otherArgs`.

 @param args - Arguments to parse (default: process.argv.slice(2))
 @returns Parsed arguments object

 @example
 ```ts
 // In a script: ./deploy.ts --dry-run -y staging
 const { dryRun, yes, otherArgs } = parseScriptArgs();
 // dryRun: true, yes: true, otherArgs: ['staging']

 await execute({ dryRun, yes });
 ```

 @example
 ```ts
 // Parse custom array
 const args = parseScriptArgs(['--yes', '--auto-log-to', './logs', 'deploy']);
 // { dryRun: false, yes: true, autoLogTo: './logs', otherArgs: ['deploy'] }
 ```
 */
export function parseScriptArgs(args: string[] = process.argv.slice(2)): ParsedScriptArgs
{
  let dryRun = false;
  let yes = false;
  let autoLogTo: string | undefined;
  const otherArgs: string[] = [];

  for (let i = 0; i < args.length; i++)
  {
    const arg = args[i]!;

    if (arg === '--dryRun' || arg === '--dry-run')
    {
      dryRun = true;
    }
    else if (arg === '-y' || arg === '--yes')
    {
      yes = true;
    }
    else if (arg === '--auto-log-to' || arg === '--autoLogTo')
    {
      const next = args[i + 1];
      if (!next || next.startsWith('-'))
      {
        throw new Error(`${arg} requires a directory path argument`);
      }
      autoLogTo = next;
      i++;
    }
    else
    {
      otherArgs.push(arg);
    }
  }

  return { dryRun, yes, autoLogTo, otherArgs };
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/parseScriptArgs.ts');

  // Test with current process args
  const parsed = parseScriptArgs();
  console.log('Parsed args:', parsed);

  // Test with sample args
  const sample = parseScriptArgs(['--dry-run', '-y', '--auto-log-to', '/tmp/logs', 'staging', 'deploy']);
  console.log('Sample parse:', sample);

  console.log('<- executed ./src/script/parseScriptArgs.ts');
}
