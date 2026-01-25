import { randomUUID } from 'node:crypto';
import { appendFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { getRedactFn } from './autoRedact.ts';
import type { FileOptions } from './FileOptions.ts';
import { normalizeFileOptions } from './FileOptions.ts';

import { writeNewFile } from '@axhxrx/write-new-file';

/**
 Central output routing context for script execution.

 Handles dual output to terminal and file, with support for filtering (command-only vs full), redaction, timestamps, and stderr handling.
 */
export class OutputContext
{
  #terminal: boolean = true;
  #filePath?: string;
  #stderrFilePath?: string;
  #fileOptions?: FileOptions;
  #redactFn?: (text: string) => string;
  #writeQueue: Promise<void> = Promise.resolve();
  #partialLine: string = '';

  /**
   Create a new OutputContext.

   @param terminal - Whether to output to terminal (default: true)
   */
  constructor(terminal: boolean = true)
  {
    this.#terminal = terminal;
  }

  /**
   Get the current log file path, if any.
   */
  get filePath(): string | undefined
  {
    return this.#filePath;
  }

  /**
   Get the current stderr file path (only set when stderr: 'separate').
   */
  get stderrFilePath(): string | undefined
  {
    return this.#stderrFilePath;
  }

  /**
   Configure file logging.

   @param options - File options (path, mode, output, redact, timestamps, stderr)
   @returns The actual file path being written to
   */
  async setFile(options?: string | boolean | FileOptions): Promise<string | undefined>
  {
    const normalized = normalizeFileOptions(options);
    if (!normalized)
    {
      this.#fileOptions = undefined;
      this.#filePath = undefined;
      this.#stderrFilePath = undefined;
      this.#redactFn = undefined;
      return undefined;
    }

    this.#fileOptions = normalized;
    this.#redactFn = getRedactFn(normalized.redact);

    // Determine file path
    if (normalized.path)
    {
      this.#filePath = normalized.path;
    }
    else
    {
      // Generate temp file path
      this.#filePath = join(tmpdir(), `script-${randomUUID()}.log`);
    }

    // Handle separate stderr file
    if (normalized.stderr === 'separate' && this.#filePath)
    {
      // Insert .stderr before extension
      const lastDot = this.#filePath.lastIndexOf('.');
      if (lastDot > 0)
      {
        this.#stderrFilePath = this.#filePath.slice(0, lastDot) + '.stderr' + this.#filePath.slice(lastDot);
      }
      else
      {
        this.#stderrFilePath = this.#filePath + '.stderr';
      }
    }

    // Initialize file based on mode
    const mode = normalized.mode ?? 'append';
    if (mode === 'overwrite')
    {
      // Truncate/create the file
      await writeFile(this.#filePath, '');
      if (this.#stderrFilePath)
      {
        await writeFile(this.#stderrFilePath, '');
      }
    }
    else if (mode === 'increment')
    {
      // Use @axhxrx/write-new-file to create unique lexically-sortable filename
      this.#filePath = await writeNewFile(this.#filePath!, '');
      if (this.#stderrFilePath)
      {
        this.#stderrFilePath = await writeNewFile(this.#stderrFilePath, '');
      }
    }
    // For 'append' mode, we don't need to do anything - appendFile creates if needed

    return this.#filePath;
  }

  /**
   Perform the actual file write (internal helper).
   */
  async #doWriteToFile(text: string, isStderr: boolean = false): Promise<void>
  {
    if (!this.#filePath) return;

    let output = text;

    // Apply redaction if configured
    if (this.#redactFn)
    {
      output = this.#redactFn(output);
    }

    // Add timestamp if configured
    if (this.#fileOptions?.timestamps)
    {
      const timestamp = new Date().toISOString();
      // Prefix each line with timestamp
      output = output.split('\n').map((line, i, arr) =>
      {
        // Don't add timestamp to empty trailing line from split
        if (i === arr.length - 1 && line === '') return '';
        return `[${timestamp}] ${line}`;
      }).join('\n');
    }

    // Handle stderr
    if (isStderr)
    {
      if (this.#fileOptions?.stderr === 'separate' && this.#stderrFilePath)
      {
        await appendFile(this.#stderrFilePath, output);
        return;
      }
      else if (this.#fileOptions?.stderr === 'prefixed')
      {
        // Prefix each line with [STDERR]
        output = output.split('\n').map((line, i, arr) =>
        {
          if (i === arr.length - 1 && line === '') return '';
          return `[STDERR] ${line}`;
        }).join('\n');
      }
      // 'interleaved' - just write as-is
    }

    await appendFile(this.#filePath, output);
  }

  /**
   Queue a write to the log file. Writes are serialized to prevent interleaving.
   */
  #queueWrite(text: string, isStderr: boolean = false): void
  {
    this.#writeQueue = this.#writeQueue.then(async () =>
    {
      await this.#doWriteToFile(text, isStderr);
    }).catch(() =>
    {
      // Silently ignore write errors
    });
  }

  /**
   Log a control plane message (framework output like "🚀 Running...").

   Goes to terminal always. Goes to file only if output mode is 'full'.
   */
  log(message: string): void
  {
    if (this.#terminal)
    {
      // eslint-disable-next-line no-console
      console.log(message);
    }

    // Only write to file if output mode is 'full' (default)
    if (this.#filePath && this.#fileOptions?.output !== 'command')
    {
      this.#queueWrite(message + '\n');
    }
  }

  /**
   Log a control plane warning.
   */
  warn(message: string): void
  {
    if (this.#terminal)
    {
      // eslint-disable-next-line no-console
      console.warn(message);
    }

    if (this.#filePath && this.#fileOptions?.output !== 'command')
    {
      this.#queueWrite(message + '\n', true);
    }
  }

  /**
   Log a control plane error.
   */
  error(message: string): void
  {
    if (this.#terminal)
    {
      // eslint-disable-next-line no-console
      console.error(message);
    }

    if (this.#filePath && this.#fileOptions?.output !== 'command')
    {
      this.#queueWrite(message + '\n', true);
    }
  }

  /**
   Write to stdout (command output passthrough).

   Goes to terminal and file always.
   */
  stdout(text: string): void
  {
    if (this.#terminal)
    {
      process.stdout.write(text);
    }

    if (this.#filePath)
    {
      this.#queueWrite(text);
    }
  }

  /**
   Write to stderr (command error output passthrough).

   Goes to terminal and file always.
   */
  stderr(text: string): void
  {
    if (this.#terminal)
    {
      process.stderr.write(text);
    }

    if (this.#filePath)
    {
      this.#queueWrite(text, true);
    }
  }

  /**
   Write raw text without newline (for progress indicators, etc).

   Goes to terminal immediately. For file output (when output mode is 'full'), partial lines are buffered and flushed when a newline is received or when close() is called.
   */
  write(text: string): void
  {
    if (this.#terminal)
    {
      process.stdout.write(text);
    }

    // Buffer for file output (only in 'full' mode, not 'command' mode)
    if (this.#filePath && this.#fileOptions?.output !== 'command')
    {
      this.#partialLine += text;

      // Check for newlines and flush complete lines
      const lastNewline = this.#partialLine.lastIndexOf('\n');
      if (lastNewline !== -1)
      {
        const completeLines = this.#partialLine.slice(0, lastNewline + 1);
        this.#partialLine = this.#partialLine.slice(lastNewline + 1);
        this.#queueWrite(completeLines);
      }
    }
  }

  /**
   Write stdout to file only (no terminal output).

   Used for writing captured output on Unix where terminal output already happened via stdio:inherit.
   */
  fileStdout(text: string): void
  {
    if (this.#filePath)
    {
      this.#queueWrite(text);
    }
  }

  /**
   Write stderr to file only (no terminal output).

   Used for writing captured output on Unix where terminal output already happened via stdio:inherit.
   */
  fileStderr(text: string): void
  {
    if (this.#filePath)
    {
      this.#queueWrite(text, true);
    }
  }

  /**
   Close the context, ensuring all pending writes complete.

   Flushes any buffered partial line (from write()) and waits for all queued writes to finish.
   */
  async close(): Promise<void>
  {
    // Flush any remaining partial line (from write() calls)
    if (this.#partialLine)
    {
      this.#queueWrite(this.#partialLine + '\n');
      this.#partialLine = '';
    }

    // Wait for all pending writes to complete
    await this.#writeQueue;

    this.#filePath = undefined;
    this.#stderrFilePath = undefined;
    this.#fileOptions = undefined;
    this.#redactFn = undefined;
  }

  /**
   Create an OutputContext configured for a step with its own file options.

   Inherits terminal setting from parent, applies step-specific file options.
   */
  async forStep(stepFileOptions?: FileOptions): Promise<OutputContext>
  {
    const stepContext = new OutputContext(this.#terminal);

    // If step has file options, use those
    if (stepFileOptions)
    {
      await stepContext.setFile(stepFileOptions);
    }
    // Otherwise inherit parent's file settings
    else if (this.#filePath)
    {
      stepContext.#filePath = this.#filePath;
      stepContext.#stderrFilePath = this.#stderrFilePath;
      stepContext.#fileOptions = this.#fileOptions;
      stepContext.#redactFn = this.#redactFn;
    }

    return stepContext;
  }
}

/**
 Default OutputContext that writes only to terminal.
 */
export const defaultOutputContext: OutputContext = new OutputContext(true);

if (import.meta.main)
{
  console.log('-> executing ./src/script/OutputContext.ts');

  const ctx = new OutputContext(true);
  ctx.log('Test log message');
  ctx.warn('Test warning');
  ctx.error('Test error');
  ctx.stdout('Test stdout\n');
  ctx.stderr('Test stderr\n');

  console.log('OutputContext class exported successfully');
  console.log('<- executed ./src/script/OutputContext.ts');
}
