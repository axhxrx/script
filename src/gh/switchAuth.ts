import { run } from '../sh/index.ts';

/**
 Attempt to switch gh auth account interactively. This is a pretty standard thing to do, as many developers have a personal GitHub account, and a work accound, and support for this is built into `gh`. The normal technique for making scripts that use `gh` robust is to try an operation, and if it fails, before giving up, try doing `gh auth switch` and then retrying the operation.

 This is common way to make scripts less annoying, by automatically handling this common situation without requiring user interaction.

 @returns true if switch succeeded, false if it failed

 @example
 ```ts
 const switched = switchGhAuth();
 if (!switched) {
   console.warn('Failed to switch gh auth');
 }
 ```
 */
export function switchGhAuth(): boolean
{
  try
  {
    run('gh auth switch', { silent: false });
    return true;
  }
  catch
  {
    return false;
  }
}
