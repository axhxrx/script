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
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/ExecuteOptions.ts');
  console.log('Exported types: ExecuteOptions');
  console.log('<- executed ./src/script/ExecuteOptions.ts');
}
