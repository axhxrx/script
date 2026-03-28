/**
 Options for file-based logging of script or step output.
 */
export interface FileOptions
{
  /**
   Path to the log file. If not specified, a temp file with a UUID name will be created.
   */
  path?: string;

  /**
   Write mode for the log file.
   - 'overwrite': Truncate file on open, write fresh
   - 'append': Open in append mode, add to existing content (default)
   - 'increment': Use @axhxrx/write-new-file to create unique lexically-sortable filename
   */
  mode?: 'overwrite' | 'append' | 'increment';

  /**
   What output to include in the log.
   - 'full': Everything - control plane messages, command output, summaries (default)
   - 'command': Only actual command stdout/stderr (excludes framework messages)
   */
  output?: 'command' | 'full';

  /**
   Redaction for sensitive data.
   - undefined/false: No redaction (default)
   - 'auto': Use built-in patterns to detect and redact common secrets
   - function: Custom redaction function that transforms output before writing
   */
  redact?: 'auto' | ((text: string) => string);

  /**
   Whether to prefix each line with an ISO timestamp.
   @default false
   */
  timestamps?: boolean;

  /**
   How to handle stderr output.
   - 'interleaved': Stderr mixed with stdout in same file, no marking (default)
   - 'prefixed': Stderr lines prefixed with [STDERR]
   - 'separate': Create separate .stderr.log file alongside the main log
   */
  stderr?: 'interleaved' | 'prefixed' | 'separate';
}

/**
 Normalize a FileOptions input (string path, boolean, or options object) to a full FileOptions object.
 */
export function normalizeFileOptions(
  input?: string | boolean | FileOptions,
): FileOptions | undefined
{
  if (input === undefined || input === false)
  {
    return undefined;
  }

  if (input === true)
  {
    // .file() with no args - use defaults
    return {};
  }

  if (typeof input === 'string')
  {
    // .file('./path.log') - path only
    return { path: input };
  }

  // Full options object
  return input;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/FileOptions.ts');
  console.log('Exported types: FileOptions');
  console.log('Exported functions: normalizeFileOptions');
  console.log('<- executed ./src/script/FileOptions.ts');
}
