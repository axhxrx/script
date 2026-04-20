/**
 Which of the child process's output streams should be scanned for `--if` / `--unless` patterns. `'both'` (the default) scans stdout and stderr; a match on either stream counts.
 */
export type StreamSelector = 'both' | 'stdout' | 'stderr';
