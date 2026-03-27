import { afterEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { autoRedact } from './autoRedact.ts';
import { normalizeFileOptions } from './FileOptions.ts';
import { OutputContext } from './OutputContext.ts';
import { Script } from './Script.ts';

/**
 Helper to create a unique temp file path.
 */
function tempPath(prefix: string): string
{
  return join(tmpdir(), `${prefix}-${randomUUID()}.log`);
}

/**
 Track files to clean up after tests.
 */
const filesToCleanup: string[] = [];

afterEach(async () =>
{
  for (const file of filesToCleanup)
  {
    await unlink(file).catch(() => {});
  }
  filesToCleanup.length = 0;
});

describe('FileOptions normalization', () =>
{
  test('normalizes boolean true to empty object (defaults applied by OutputContext)', () =>
  {
    const result = normalizeFileOptions(true);
    expect(result).toEqual({});
  });

  test('normalizes false to undefined', () =>
  {
    const result = normalizeFileOptions(false);
    expect(result).toBeUndefined();
  });

  test('normalizes string to path only (defaults applied by OutputContext)', () =>
  {
    const result = normalizeFileOptions('./test.log');
    expect(result).toEqual({
      path: './test.log',
    });
  });

  test('preserves full options object', () =>
  {
    const opts = {
      path: './custom.log',
      mode: 'overwrite' as const,
      output: 'command' as const,
      redact: 'auto' as const,
      timestamps: true,
      stderr: 'prefixed' as const,
    };
    const result = normalizeFileOptions(opts);
    expect(result).toEqual(opts);
  });
});

describe('autoRedact patterns', () =>
{
  test('redacts password assignments', () =>
  {
    expect(autoRedact('password=secret123')).toBe('[REDACTED_SECRET]');
    expect(autoRedact('PASSWORD: "my-pass"')).toBe('[REDACTED_SECRET]');
  });

  test('redacts Bearer tokens', () =>
  {
    expect(autoRedact('Bearer abc123xyz')).toBe('Bearer [REDACTED_TOKEN]');
  });

  test('redacts AWS access keys', () =>
  {
    expect(autoRedact('AKIAIOSFODNN7EXAMPLE')).toBe('[REDACTED_AWS_KEY]');
  });

  test('redacts GitHub tokens', () =>
  {
    expect(autoRedact('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe('[REDACTED_GITHUB_TOKEN]');
  });

  test('redacts JWT tokens', () =>
  {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(autoRedact(jwt)).toBe('[REDACTED_JWT]');
  });

  test('preserves normal text', () =>
  {
    expect(autoRedact('Hello, world!')).toBe('Hello, world!');
    expect(autoRedact('npm install express')).toBe('npm install express');
  });
});

describe('OutputContext', () =>
{
  test('writes to file when configured', async () =>
  {
    const path = tempPath('output-ctx');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false); // no terminal output
    await ctx.setFile({ path, mode: 'overwrite' });

    ctx.log('Hello from log');
    ctx.stdout('stdout message\n');
    ctx.stderr('stderr message\n');

    await ctx.close();

    // Give a moment for async writes
    await new Promise((r) => setTimeout(r, 50));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Hello from log');
    expect(content).toContain('stdout message');
    expect(content).toContain('stderr message');
  });

  test('output: command excludes control plane messages', async () =>
  {
    const path = tempPath('output-cmd');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', output: 'command' });

    ctx.log('Control plane message'); // Should NOT appear
    ctx.stdout('Command output\n'); // Should appear

    await ctx.close();
    await new Promise((r) => setTimeout(r, 50));

    const content = await readFile(path, 'utf-8');
    expect(content).not.toContain('Control plane');
    expect(content).toContain('Command output');
  });

  test('stderr: prefixed adds [STDERR] prefix', async () =>
  {
    const path = tempPath('stderr-prefix');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'prefixed' });

    ctx.stderr('error line\n');

    await ctx.close();
    await new Promise((r) => setTimeout(r, 50));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('[STDERR] error line');
  });

  test('stderr: separate creates separate file', async () =>
  {
    const path = tempPath('stderr-sep');
    const stderrPath = path.replace('.log', '.stderr.log');
    filesToCleanup.push(path, stderrPath);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'separate' });

    expect(ctx.stderrFilePath).toBe(stderrPath);

    ctx.stdout('stdout\n');
    ctx.stderr('stderr\n');

    await ctx.close();
    await new Promise((r) => setTimeout(r, 50));

    const mainContent = await readFile(path, 'utf-8');
    const stderrContent = await readFile(stderrPath, 'utf-8');

    expect(mainContent).toContain('stdout');
    expect(mainContent).not.toContain('stderr\n');
    expect(stderrContent).toContain('stderr');
  });

  test('redact: auto applies auto-redaction', async () =>
  {
    const path = tempPath('redact');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', redact: 'auto' });

    ctx.stdout('password=supersecret123\n');

    await ctx.close();
    await new Promise((r) => setTimeout(r, 50));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('[REDACTED_SECRET]');
    expect(content).not.toContain('supersecret123');
  });

  test('timestamps: true adds ISO timestamps', async () =>
  {
    const path = tempPath('timestamps');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', timestamps: true });

    ctx.stdout('timestamped line\n');

    await ctx.close();
    await new Promise((r) => setTimeout(r, 50));

    const content = await readFile(path, 'utf-8');
    // Should have ISO timestamp format like [2024-01-25T10:30:45.123Z]
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/);
    expect(content).toContain('timestamped line');
  });
});

describe('Script.file()', () =>
{
  test('configures script-level file logging', async () =>
  {
    const path = tempPath('script-file');
    filesToCleanup.push(path);

    const script = new Script();
    const returnedPath = await script.file({ path, mode: 'overwrite' });

    expect(returnedPath).toBe(path);

    script.add('echo "SCRIPT_FILE_TEST"');
    await script.execute({ yes: true, printResults: false });

    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('SCRIPT_FILE_TEST');
  });

  test('creates temp file when called with no args', async () =>
  {
    const script = new Script();
    const path = await script.file();

    expect(path).toBeDefined();
    expect(path).toContain(tmpdir());
    filesToCleanup.push(path!);

    script.add('echo "TEMP_FILE_TEST"');
    await script.execute({ yes: true, printResults: false });

    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path!, 'utf-8');
    expect(content).toContain('TEMP_FILE_TEST');
  });

  test('preserves validation progress lines in script-level logs', async () =>
  {
    const path = tempPath('script-validations');
    filesToCleanup.push(path);

    const script = new Script();
    await script.file({ path, mode: 'overwrite' });
    script.validate('Always passes', () => true);
    script.add('echo "VALIDATION_LOG_TEST"');

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('○ Always passes... ✓');
    expect(content).toContain('VALIDATION_LOG_TEST');
  });
});

describe('StepBuilder.file()', () =>
{
  test('configures step-level file logging', async () =>
  {
    const stepPath = tempPath('step-file');
    filesToCleanup.push(stepPath);

    const script = new Script();
    script.add('echo "STEP_FILE_TEST"').file({ path: stepPath, mode: 'overwrite', output: 'command' });
    await script.execute({ yes: true, printResults: false });

    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(stepPath, 'utf-8');
    expect(content).toContain('STEP_FILE_TEST');
  });

  test('different steps log to different files', async () =>
  {
    const path1 = tempPath('step1');
    const path2 = tempPath('step2');
    filesToCleanup.push(path1, path2);

    const script = new Script();
    script.add('echo "OUTPUT_ONE"').file({ path: path1, mode: 'overwrite', output: 'command' });
    script.add('echo "OUTPUT_TWO"').file({ path: path2, mode: 'overwrite', output: 'command' });
    await script.execute({ yes: true, printResults: false });

    await new Promise((r) => setTimeout(r, 100));

    const content1 = await readFile(path1, 'utf-8');
    const content2 = await readFile(path2, 'utf-8');

    expect(content1).toContain('OUTPUT_ONE');
    expect(content1).not.toContain('OUTPUT_TWO');

    expect(content2).toContain('OUTPUT_TWO');
    expect(content2).not.toContain('OUTPUT_ONE');
  });
});

describe('File logging with .or() and .and() chains', () =>
{
  test('logs fallback execution to step file', async () =>
  {
    const path = tempPath('chain-fallback');
    filesToCleanup.push(path);

    const script = new Script();
    script.add('exit 1')
      .description('Fail intentionally')
      .file({ path, mode: 'overwrite', output: 'command' })
      .or('echo "FALLBACK_EXECUTED"');

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('FALLBACK_EXECUTED');
  });

  test('logs continuation execution to step file', async () =>
  {
    const path = tempPath('chain-continue');
    filesToCleanup.push(path);

    const script = new Script();
    script.add('echo "PRIMARY"')
      .file({ path, mode: 'overwrite', output: 'command' })
      .and('echo "CONTINUATION"');

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('PRIMARY');
    expect(content).toContain('CONTINUATION');
  });
});

describe('Function step console capture', () =>
{
  test('captures console.log from function when file logging enabled', async () =>
  {
    const path = tempPath('fn-console');
    filesToCleanup.push(path);

    const script = new Script();
    await script.file({ path, mode: 'overwrite' });

    script.add(async () =>
    {
      console.log('FUNCTION_LOG_CAPTURED');
    }).description('Function with console.log');

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('FUNCTION_LOG_CAPTURED');
  });

  test('captures console.warn and console.error from function', async () =>
  {
    const path = tempPath('fn-warn-error');
    filesToCleanup.push(path);

    const script = new Script();
    await script.file({ path, mode: 'overwrite' });

    script.add(async () =>
    {
      console.warn('FUNCTION_WARN');
      console.error('FUNCTION_ERROR');
    }).description('Function with console.warn/error');

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('FUNCTION_WARN');
    expect(content).toContain('FUNCTION_ERROR');
  });
});

describe('File logging mode: append', () =>
{
  test('appends to existing file', async () =>
  {
    const path = tempPath('append-mode');
    filesToCleanup.push(path);

    // First script writes initial content
    const script1 = new Script();
    await script1.file({ path, mode: 'overwrite' });
    script1.add('echo "FIRST_RUN"');
    await script1.execute({ yes: true, printResults: false });

    // Second script appends
    const script2 = new Script();
    await script2.file({ path, mode: 'append' });
    script2.add('echo "SECOND_RUN"');
    await script2.execute({ yes: true, printResults: false });

    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('FIRST_RUN');
    expect(content).toContain('SECOND_RUN');
  });
});

describe('Integration: real script execution with file logging', () =>
{
  test('complete workflow with multiple log files', async () =>
  {
    const mainLog = tempPath('main');
    const gitLog = tempPath('git');
    const cleanupLog = tempPath('cleanup');
    filesToCleanup.push(mainLog, gitLog, cleanupLog);

    const script = new Script();
    await script.file({ path: mainLog, mode: 'overwrite', output: 'full' });

    script.banner('Workflow Test');

    // Step 1: Simulate git operation
    script.add('echo "Checking git status..."')
      .description('Git check')
      .file({ path: gitLog, mode: 'overwrite', output: 'command' });

    // Step 2: Use .and() continuation
    script.add('echo "Building project..."')
      .and('echo "Build complete!"');

    // Step 3: Cleanup function
    script.add(async () =>
    {
      console.log('Cleanup: removing temp files');
    })
      .description('Cleanup')
      .file({ path: cleanupLog, mode: 'overwrite' });

    const result = await script.execute({ yes: true, printResults: false });

    await new Promise((r) => setTimeout(r, 100));

    expect(result.state).toBe('complete');

    // Verify main log has framework messages
    const mainContent = await readFile(mainLog, 'utf-8');
    expect(mainContent).toContain('Workflow Test'); // Banner
    expect(mainContent).toContain('Executing'); // Framework message

    // Verify git log has only command output
    const gitContent = await readFile(gitLog, 'utf-8');
    expect(gitContent).toContain('Checking git status');
    expect(gitContent).not.toContain('Workflow Test'); // No banner

    // Verify cleanup log has function output
    const cleanupContent = await readFile(cleanupLog, 'utf-8');
    expect(cleanupContent).toContain('removing temp files');
  });
});

describe('Issue fixes', () =>
{
  test('Issue 1: Chain step with its own .file() logs to its file', async () =>
  {
    const rootPath = tempPath('chain-root');
    const orPath = tempPath('chain-or');
    filesToCleanup.push(rootPath, orPath);

    const script = new Script();
    script.add('exit 1')
      .description('Root step (will fail)')
      .file({ path: rootPath, mode: 'overwrite', output: 'command' })
      .or('echo "OR_STEP_OUTPUT"')
      .file({ path: orPath, mode: 'overwrite', output: 'command' });

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    // The OR step should write to its own file, not the root step's file
    const orContent = await readFile(orPath, 'utf-8');
    expect(orContent).toContain('OR_STEP_OUTPUT');
  });

  test('Issue 2: console.log preserves util.format formatting', async () =>
  {
    const path = tempPath('format-test');
    filesToCleanup.push(path);

    const script = new Script();
    await script.file({ path, mode: 'overwrite' });

    script.add(async () =>
    {
      console.log('Count: %d, Name: %s', 42, 'test');
      console.log({ nested: { value: 123 } });
    }).description('Format test');

    await script.execute({ yes: true, printResults: false });
    await new Promise((r) => setTimeout(r, 100));

    const content = await readFile(path, 'utf-8');
    // Should use util.format, not just String conversion
    expect(content).toContain('Count: 42, Name: test');
    expect(content).toContain('nested');
    expect(content).toContain('123');
    // Should NOT have [object Object]
    expect(content).not.toContain('[object Object]');
  });

  test('Issue 3: Write queue preserves order', async () =>
  {
    const path = tempPath('write-order');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    // Write many lines quickly
    for (let i = 0; i < 100; i++)
    {
      ctx.log(`Line ${i}`);
    }

    await ctx.close();

    const content = await readFile(path, 'utf-8');
    const lines = content.split('\n').filter((l) => l.startsWith('Line '));

    // Verify all lines are present and in order
    expect(lines).toHaveLength(100);
    for (let i = 0; i < 100; i++)
    {
      expect(lines[i]).toBe(`Line ${i}`);
    }
  });

  test('Issue 5: write() partial lines appear in full logs', async () =>
  {
    const path = tempPath('partial-lines');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    // Simulate progress output like "Validating... ✓"
    ctx.write('Validating... ');
    ctx.write('✓');
    ctx.log(''); // Newline

    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Validating... ✓');
  });

  test('Issue 5: write() flushes remaining partial line on close', async () =>
  {
    const path = tempPath('partial-flush');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    // Write without final newline
    ctx.write('Partial line without newline');

    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Partial line without newline');
  });
});
