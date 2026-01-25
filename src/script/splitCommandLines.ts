/**
 Split a multi-line command string into individual commands.

 Handles:
 - Empty lines (skipped)
 - Comment lines starting with # (skipped)
 - Backslash line continuations (joined)
 - Leading/trailing whitespace (trimmed)

 NOTE: When using backslash continuation in template literals, remember that TypeScript/JavaScript interprets `\ ` (backslash-space) as an escape sequence that produces just a space. To get a literal backslash for continuation, use `\\` in your template literal. This is a subtle bug that's easy to introduce and hard to notice.
 */
export function splitCommandLines(input: string): string[]
{
  const lines = input.split('\n');
  const commands: string[] = [];
  let continuation = '';

  for (const rawLine of lines)
  {
    const line = rawLine.trim();

    // Skip empty lines and comment-only lines
    if (line === '' || line.startsWith('#'))
    {
      continue;
    }

    // Handle backslash continuation
    if (line.endsWith('\\'))
    {
      continuation += line.slice(0, -1) + ' ';
      continue;
    }

    // Complete command (with any accumulated continuation)
    commands.push(continuation + line);
    continuation = '';
  }

  // Handle trailing continuation (edge case - treat as complete)
  if (continuation)
  {
    commands.push(continuation.trim());
  }

  return commands;
}
