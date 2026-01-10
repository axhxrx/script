/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { run } from '../sh/index.ts';
import type { Step } from './Step.ts';

/**
 Run a single step (either a shell command or a function).
 */
export async function runStep(step: Step): Promise<void>
{
  const { command, fn, options } = step;
  const desc = options.description || command || '[function step]';

  console.log(`▶ ${desc}`);
  if (command && options.description)
  {
    console.log(`  $ ${command}`);
  }

  try
  {
    if (fn)
    {
      // Execute function step
      await fn();
    }
    else if (command)
    {
      if (options.interactive)
      {
        // Use spawnSync for interactive commands (browser auth flows, etc.)
        const result = spawnSync(command, {
          stdio: 'inherit',
          cwd: options.cwd,
          shell: true,
          env: { ...process.env, ...options.env },
        });

        if (result.status !== 0 && options.onError !== 'continue')
        {
          const error = new Error(
            `Command failed with exit code ${result.status}`,
          );
          if (options.onError === 'warn')
          {
            console.warn(`⚠️  ${error.message}`);
          }
          else
          {
            throw error;
          }
        }
      }
      else
      {
        // Use exec for non-interactive commands
        run(command, { cwd: options.cwd });
      }
    }

    console.log('✓ Done\n');
  }
  catch (error: unknown)
  {
    if (options.onError === 'warn')
    {
      console.warn(
        `⚠️  Warning: ${error instanceof Error ? error.message : error}\n`,
      );
    }
    else if (options.onError === 'continue')
    {
      console.log('✓ Continued (error ignored)\n');
    }
    else
    {
      throw error;
    }
  }
}
