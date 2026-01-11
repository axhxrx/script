import { runQuiet } from '../sh/index.ts';

/**
 Check if gh CLI is authenticated and get the active username.

 Handles both single-account and multi-account formats. For multi-account, returns the active account.

 @returns The authenticated GitHub username, or null if not authenticated or gh not found

 @example
 ```ts
 const username = getGhAuthUsername();
 if (username) {
   console.log(`Authenticated as ${username}`);
 }
 ```
 */
export function getGhAuthUsername(): string | null
{
  try
  {
    const status = runQuiet('gh auth status 2>&1');

    // Multi-account format: Look for "account USERNAME" followed by "Active account: true"
    // Split into lines and find the active account
    const lines = status.split('\n');
    for (let i = 0; i < lines.length; i++)
    {
      const accountMatch = lines[i].match(/account\s+(\S+)/);
      if (accountMatch && i + 1 < lines.length)
      {
        // Check if next line says "Active account: true"
        if (lines[i + 1].includes('Active account: true'))
        {
          return accountMatch[1];
        }
      }
    }

    // Fallback: Single-account format "Logged in to github.com as username"
    const singleMatch = status.match(/Logged in to \S+ as (\S+)/);
    return singleMatch ? singleMatch[1] : null;
  }
  catch (_error: unknown)
  {
    return null;
  }
}

if (import.meta.main)
{
  console.log('-> executing ./src/gh/getAuthUsername.ts');

  // Exercise the function (read-only)
  const username = getGhAuthUsername();
  console.log('GitHub auth username:', username || '(not authenticated)');

  console.log('<- executed ./src/gh/getAuthUsername.ts');
}
