import { afterEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultOutputContext, OutputContext } from './OutputContext.ts';

/**
 Helper to create a unique temp file path.
 */
function tempPath(prefix: string, ext: string = '.log'): string
{
  return join(tmpdir(), `${prefix}-${randomUUID()}${ext}`);
}

/**
 Track files to clean up after tests.
 */
const filesToCleanup: string[] = [];

afterEach(async () =>
{
  for (const file of filesToCleanup)
  {
    await unlink(file).catch(() =>
    {});
  }
  filesToCleanup.length = 0;
});

describe('OutputContext getters', () =>
{
  test('filePath is undefined before setFile', () =>
  {
    const ctx = new OutputContext(false);
    expect(ctx.filePath).toBeUndefined();
  });

  test('stderrFilePath is undefined before setFile', () =>
  {
    const ctx = new OutputContext(false);
    expect(ctx.stderrFilePath).toBeUndefined();
  });

  test('filePath reflects the configured path after setFile', async () =>
  {
    const path = tempPath('getter-path');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    expect(ctx.filePath).toBe(path);
    await ctx.close();
  });

  test('stderrFilePath is set when stderr: separate', async () =>
  {
    const path = tempPath('getter-stderr');
    const expectedStderrPath = path.replace('.log', '.stderr.log');
    filesToCleanup.push(path, expectedStderrPath);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'separate' });

    expect(ctx.stderrFilePath).toBe(expectedStderrPath);
    await ctx.close();
  });
});

describe('setFile shorthand forms', () =>
{
  test('setFile(false) disables file logging', async () =>
  {
    const path = tempPath('disable');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });
    expect(ctx.filePath).toBe(path);

    await ctx.setFile(false);
    expect(ctx.filePath).toBeUndefined();
    expect(ctx.stderrFilePath).toBeUndefined();
  });

  test('setFile(undefined) disables file logging', async () =>
  {
    const path = tempPath('undef');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    await ctx.setFile(undefined);
    expect(ctx.filePath).toBeUndefined();
  });

  test('setFile(true) generates a temp file path', async () =>
  {
    const ctx = new OutputContext(false);
    const resultPath = await ctx.setFile(true);

    expect(resultPath).toBeDefined();
    expect(resultPath!).toContain(tmpdir());
    filesToCleanup.push(resultPath!);

    expect(ctx.filePath).toBe(resultPath);
    await ctx.close();
  });

  test('setFile(string) uses the string as path', async () =>
  {
    const path = tempPath('string-form');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    const resultPath = await ctx.setFile(path);

    expect(resultPath).toBe(path);
    expect(ctx.filePath).toBe(path);
    await ctx.close();
  });
});

describe('setFile mode: increment', () =>
{
  test('creates a unique filename based on the given path', async () =>
  {
    // writeNewFile resolves relative to CWD, so use a relative path
    const dir = `.tmp-test-${randomUUID()}`;
    await mkdir(dir, { recursive: true });
    const basePath = join(dir, 'increment.log');

    const ctx = new OutputContext(false);
    const actualPath = await ctx.setFile({ path: basePath, mode: 'increment' });

    expect(actualPath).toBeDefined();
    // writeNewFile creates a unique name — it won't be exactly basePath
    expect(actualPath).not.toBe(basePath);
    filesToCleanup.push(actualPath!);

    ctx.log('increment test');
    await ctx.close();

    const content = await readFile(actualPath!, 'utf-8');
    expect(content).toContain('increment test');

    // Clean up temp files and directory
    await rm(dir, { recursive: true, force: true }).catch(() =>
    {});
  });
});

describe('warn() and error() file output', () =>
{
  test('warn() writes to file in full output mode', async () =>
  {
    const path = tempPath('warn-full');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    ctx.warn('Warning message');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Warning message');
  });

  test('error() writes to file in full output mode', async () =>
  {
    const path = tempPath('error-full');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    ctx.error('Error message');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Error message');
  });

  test('warn() is excluded in command output mode', async () =>
  {
    const path = tempPath('warn-cmd');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', output: 'command' });

    ctx.warn('Should not appear');
    ctx.stdout('Command output\n');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).not.toContain('Should not appear');
    expect(content).toContain('Command output');
  });

  test('error() is excluded in command output mode', async () =>
  {
    const path = tempPath('error-cmd');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', output: 'command' });

    ctx.error('Should not appear');
    ctx.stdout('Command output\n');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).not.toContain('Should not appear');
    expect(content).toContain('Command output');
  });

  test('warn() respects stderr: prefixed', async () =>
  {
    const path = tempPath('warn-prefix');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'prefixed' });

    ctx.warn('Prefixed warning');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('[STDERR] Prefixed warning');
  });

  test('error() respects stderr: separate', async () =>
  {
    const path = tempPath('error-sep');
    const stderrPath = path.replace('.log', '.stderr.log');
    filesToCleanup.push(path, stderrPath);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'separate' });

    ctx.log('Normal log');
    ctx.error('Separated error');
    await ctx.close();

    const mainContent = await readFile(path, 'utf-8');
    const stderrContent = await readFile(stderrPath, 'utf-8');

    expect(mainContent).toContain('Normal log');
    expect(mainContent).not.toContain('Separated error');
    expect(stderrContent).toContain('Separated error');
  });
});

describe('fileStdout() and fileStderr()', () =>
{
  test('fileStdout() writes to file without terminal output', async () =>
  {
    const path = tempPath('file-stdout');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    ctx.fileStdout('File-only stdout\n');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('File-only stdout');
  });

  test('fileStderr() writes to file without terminal output', async () =>
  {
    const path = tempPath('file-stderr');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    ctx.fileStderr('File-only stderr\n');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('File-only stderr');
  });

  test('fileStderr() respects stderr: prefixed', async () =>
  {
    const path = tempPath('file-stderr-prefix');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'prefixed' });

    ctx.fileStderr('Prefixed file stderr\n');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('[STDERR] Prefixed file stderr');
  });

  test('fileStderr() respects stderr: separate', async () =>
  {
    const path = tempPath('file-stderr-sep');
    const stderrPath = path.replace('.log', '.stderr.log');
    filesToCleanup.push(path, stderrPath);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'separate' });

    ctx.fileStdout('Main content\n');
    ctx.fileStderr('Separate stderr\n');
    await ctx.close();

    const mainContent = await readFile(path, 'utf-8');
    const stderrContent = await readFile(stderrPath, 'utf-8');

    expect(mainContent).toContain('Main content');
    expect(mainContent).not.toContain('Separate stderr');
    expect(stderrContent).toContain('Separate stderr');
  });

  test('fileStdout() is a no-op when no file configured', async () =>
  {
    const ctx = new OutputContext(false);
    // Should not throw
    ctx.fileStdout('Goes nowhere\n');
    await ctx.close();
  });
});

describe('forStep()', () =>
{
  test('creates step context with its own file options', async () =>
  {
    const parentPath = tempPath('parent');
    const stepPath = tempPath('step');
    filesToCleanup.push(parentPath, stepPath);

    const parent = new OutputContext(false);
    await parent.setFile({ path: parentPath, mode: 'overwrite' });

    const step = await parent.forStep({
      path: stepPath,
      mode: 'overwrite',
      output: 'command',
    });

    expect(step.filePath).toBe(stepPath);

    // Step should use its own file
    step.stdout('Step output\n');
    step.log('Control message');
    await step.close();

    const stepContent = await readFile(stepPath, 'utf-8');
    expect(stepContent).toContain('Step output');
    // output: 'command' means control messages excluded
    expect(stepContent).not.toContain('Control message');

    await parent.close();
  });

  test('inherits parent file settings when no step options given', async () =>
  {
    const path = tempPath('inherit');
    filesToCleanup.push(path);

    const parent = new OutputContext(false);
    await parent.setFile({ path, mode: 'overwrite' });

    const step = await parent.forStep();

    expect(step.filePath).toBe(path);

    step.stdout('Inherited write\n');
    await step.close();
    await parent.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Inherited write');
  });

  test('returns terminal-only context when parent has no file and no step options', async () =>
  {
    const parent = new OutputContext(false);
    const step = await parent.forStep();

    expect(step.filePath).toBeUndefined();
    // Should not throw
    step.stdout('No file\n');
    await step.close();
  });
});

describe('close() clears state', () =>
{
  test('filePath is undefined after close', async () =>
  {
    const path = tempPath('close-clear');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });
    expect(ctx.filePath).toBe(path);

    await ctx.close();
    expect(ctx.filePath).toBeUndefined();
    expect(ctx.stderrFilePath).toBeUndefined();
  });

  test('writes after close are silently ignored', async () =>
  {
    const path = tempPath('post-close');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite' });

    ctx.log('Before close');
    await ctx.close();

    // These should be no-ops
    ctx.log('After close');
    ctx.stdout('After close stdout\n');
    ctx.stderr('After close stderr\n');
    ctx.write('After close write');

    // Give time for any async writes
    await new Promise((r) => setTimeout(r, 50));

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('Before close');
    expect(content).not.toContain('After close');
  });
});

describe('stderr: separate path generation edge cases', () =>
{
  test('handles path without extension', async () =>
  {
    const path = tempPath('no-ext', '');
    const expectedStderrPath = path + '.stderr';
    filesToCleanup.push(path, expectedStderrPath);

    const ctx = new OutputContext(false);
    await ctx.setFile({ path, mode: 'overwrite', stderr: 'separate' });

    expect(ctx.stderrFilePath).toBe(expectedStderrPath);

    ctx.stdout('main\n');
    ctx.stderr('err\n');
    await ctx.close();

    const mainContent = await readFile(path, 'utf-8');
    const stderrContent = await readFile(expectedStderrPath, 'utf-8');

    expect(mainContent).toContain('main');
    expect(stderrContent).toContain('err');
  });
});

describe('custom redact function', () =>
{
  test('applies a custom redact function to file output', async () =>
  {
    const path = tempPath('custom-redact');
    filesToCleanup.push(path);

    const ctx = new OutputContext(false);
    await ctx.setFile({
      path,
      mode: 'overwrite',
      redact: (text: string) => text.replace(/SECRET/g, '***'),
    });

    ctx.stdout('The SECRET is hidden\n');
    await ctx.close();

    const content = await readFile(path, 'utf-8');
    expect(content).toContain('The *** is hidden');
    expect(content).not.toContain('SECRET');
  });
});

describe('defaultOutputContext', () =>
{
  test('is an OutputContext instance with no file configured', () =>
  {
    expect(defaultOutputContext).toBeInstanceOf(OutputContext);
    expect(defaultOutputContext.filePath).toBeUndefined();
  });
});
