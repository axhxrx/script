import { describe, expect, test } from 'bun:test';

import { parseCli } from './parseCli.ts';

describe('parseCli', () =>
{
  test('rejects missing command', () =>
  {
    const r = parseCli([]);
    expect(r.error).toBeDefined();
    expect(r.command).toBe('');
  });

  test('rejects multiple positionals', () =>
  {
    const r = parseCli(['pnpm', 'build']);
    expect(r.error).toContain('single quoted command');
  });

  test('accepts a single quoted command', () =>
  {
    const r = parseCli(['pnpm build && pnpm test']);
    expect(r.error).toBeUndefined();
    expect(r.command).toBe('pnpm build && pnpm test');
  });

  test('parses retry flags before the command', () =>
  {
    const r = parseCli(['--max-retries', '3', '--delay-ms', '500', '--quiet', 'pnpm test']);
    expect(r.error).toBeUndefined();
    expect(r.options.maxRetries).toBe(3);
    expect(r.options.delayMs).toBe(500);
    expect(r.options.quiet).toBe(true);
    expect(r.command).toBe('pnpm test');
  });

  test('collects repeated --if and --unless patterns', () =>
  {
    const r = parseCli([
      '--if',
      "Unhandled 'error' event",
      '--if',
      'ECONNRESET',
      '--unless',
      'compilation failed',
      'pnpm test',
    ]);
    expect(r.options.ifPatterns).toEqual(["Unhandled 'error' event", 'ECONNRESET']);
    expect(r.options.unlessPatterns).toEqual(['compilation failed']);
  });

  test('default stream selector is both', () =>
  {
    const r = parseCli(['pnpm test']);
    expect(r.options.streamSelector).toBe('both');
  });

  test('--stdout-only sets selector', () =>
  {
    const r = parseCli(['--stdout-only', 'pnpm test']);
    expect(r.options.streamSelector).toBe('stdout');
  });

  test('--stderr-only sets selector', () =>
  {
    const r = parseCli(['--stderr-only', 'pnpm test']);
    expect(r.options.streamSelector).toBe('stderr');
  });

  test('--stdout-only and --stderr-only together is an error', () =>
  {
    const r = parseCli(['--stdout-only', '--stderr-only', 'pnpm test']);
    expect(r.error).toContain('mutually exclusive');
  });

  test('rejects non-numeric --max-retries', () =>
  {
    const r = parseCli(['--max-retries', 'abc', 'pnpm test']);
    expect(r.error).toContain('--max-retries');
  });

  test('rejects decimal --max-retries', () =>
  {
    const r = parseCli(['--max-retries', '1.5', 'pnpm test']);
    expect(r.error).toContain('--max-retries');
  });

  test('rejects negative --delay-ms', () =>
  {
    const r = parseCli(['--delay-ms', '-1', 'pnpm test']);
    expect(r.error).toBeDefined();
  });

  test('rejects suffixed --delay-ms', () =>
  {
    const r = parseCli(['--delay-ms', '10ms', 'pnpm test']);
    expect(r.error).toContain('--delay-ms');
  });

  test('--help short-circuits', () =>
  {
    const r = parseCli(['--help']);
    expect(r.help).toBe(true);
    expect(r.error).toBeUndefined();
  });

  test('rejects unknown retry flag', () =>
  {
    const r = parseCli(['--wacky-flag', 'pnpm test']);
    expect(r.error).toBeDefined();
  });
});
