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

  /**
   Print a summary of execution results at the end. This summary is printed for both successful completion and error cases, showing step timings and any errors.

   @default true
   */
  printResults?: boolean;

  /**
   Capture stdout/stderr from non-interactive command steps. When enabled, output is both streamed to the terminal in real-time AND captured in stepResults for later inspection.

   Set to false to disable capture (slightly better performance, but stepResults won't have stdout/stderr).

   @default true
   */
  captureOutput?: boolean;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/ExecuteOptions.ts');
  console.log('Exported types: ExecuteOptions');
  console.log('<- executed ./src/script/ExecuteOptions.ts');
}
