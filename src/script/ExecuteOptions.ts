/**
 Options for executing a Script.
 */
export interface ExecuteOptions
{
  /**
   Print the plan without executing.
   */
  dryRun?: boolean;

  /**
   Skip the confirmation prompt and run immediately. By default, execute() shows the plan and asks for confirmation.
   */
  yes?: boolean;

  /**
   Prompt for confirmation before each individual step. Individual steps can also have their own .confirm() setting.
   */
  confirmEach?: boolean;

  /**
   Automatically parse process.argv for common flags (--dryRun, --dry-run, -y, --yes) using parseScriptArgs().

   When true, parsed flags are used as defaults, but explicit options you pass always take precedence. For example:

   @example
   ```ts
   // User runs: ./deploy.ts --dry-run
   await execute({ parseArgs: true });
   // → dryRun is true (from CLI)

   // User runs: ./deploy.ts --dry-run
   await execute({ parseArgs: true, dryRun: false });
   // → dryRun is false (explicit option overrides CLI)
   ```

   @default false
   */
  parseArgs?: boolean;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/ExecuteOptions.ts');
  console.log('Exported types: ExecuteOptions');
  console.log('<- executed ./src/script/ExecuteOptions.ts');
}
