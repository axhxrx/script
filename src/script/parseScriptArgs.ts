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
   All other arguments that weren't recognized as flags.
   */
  otherArgs: string[];
}

/**
 Parse common script arguments from process.argv (or a custom array).

 Recognizes:
 - `--dryRun` or `--dry-run` → `dryRun: true`
 - `-y` or `--yes` → `yes: true`

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
 const args = parseScriptArgs(['--yes', 'build', 'deploy']);
 // { dryRun: false, yes: true, otherArgs: ['build', 'deploy'] }
 ```
 */
export function parseScriptArgs(args: string[] = process.argv.slice(2)): ParsedScriptArgs
{
  let dryRun = false;
  let yes = false;
  const otherArgs: string[] = [];

  for (const arg of args)
  {
    if (arg === '--dryRun' || arg === '--dry-run')
    {
      dryRun = true;
    }
    else if (arg === '-y' || arg === '--yes')
    {
      yes = true;
    }
    else
    {
      otherArgs.push(arg);
    }
  }

  return { dryRun, yes, otherArgs };
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/parseScriptArgs.ts');

  // Test with current process args
  const parsed = parseScriptArgs();
  console.log('Parsed args:', parsed);

  // Test with sample args
  const sample = parseScriptArgs(['--dry-run', '-y', 'staging', 'deploy']);
  console.log('Sample parse:', sample);

  console.log('<- executed ./src/script/parseScriptArgs.ts');
}
