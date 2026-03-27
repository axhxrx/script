#!/usr/bin/env bun
/**
 Release-prep example: compute the next version, validate the repo, preview notes,
 run quality gates, and log command output to a file.

 Usage:
   bun examples/08-release-prep.ts [patch|minor|major] [--dry-run] [--yes]
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { createScript, parseScriptArgs, runQuiet } from '@axhxrx/script';

type BumpType = 'major' | 'minor' | 'patch';

function bumpVersion(version: string, type: BumpType): string
{
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((value) =>
  {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  });

  if (type === 'major')
  {
    return `${major + 1}.0.0`;
  }

  if (type === 'minor')
  {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

const { dryRun, yes, otherArgs } = parseScriptArgs();
const bumpType = (['major', 'minor', 'patch'].find((value) => otherArgs.includes(value)) ?? 'patch') as BumpType;
const logPath = join(tmpdir(), `script-release-${randomUUID()}.log`);
const draftNotesPath = join(tmpdir(), `script-release-notes-${randomUUID()}.md`);

const packageJson = existsSync('package.json')
  ? JSON.parse(readFileSync('package.json', 'utf-8')) as { name?: string; version?: string }
  : {};
const currentVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
const nextVersion = bumpVersion(currentVersion, bumpType);

const script = createScript();

await script.file({
  path: logPath,
  output: 'full',
  timestamps: true,
});

script.validate('Inside a git repository', () =>
{
  try
  {
    return runQuiet('git rev-parse --is-inside-work-tree').trim() === 'true'
      || 'Run this from a git repository.';
  }
  catch
  {
    return 'Git is not installed or this is not a git repository.';
  }
});

script.validate('package.json exists', () =>
{
  return existsSync('package.json') || 'package.json is required for this example.';
});

script.validate('Working directory is clean', () =>
{
  return runQuiet('git status --porcelain').trim() === '' || 'Commit or stash your changes before a release.';
});

script.banner('Release Prep');

script.add(() =>
{
  const latestCommit = runQuiet('git log -1 --oneline').trim();
  console.log(`Package: ${packageJson.name ?? '(unknown package)'}`);
  console.log(`Version: ${currentVersion} -> ${nextVersion}`);
  console.log(`Latest commit: ${latestCommit}`);
  console.log(`Command log: ${logPath}`);
}).description('Summarize the release candidate');

script.add('test -f CHANGELOG.md && tail -n 12 CHANGELOG.md')
  .description('Preview the changelog')
  .or(
    `printf "# Release ${nextVersion}\\n\\n- summarize the change here\\n" > "${draftNotesPath}" && cat "${draftNotesPath}"`,
  )
  .and(`echo "Drafted release notes: ${draftNotesPath}"`);

script.add(`
  bun test
  deno check src/mod.ts
`).description('Run release quality gates');

script.add('git diff --stat')
  .description('Review the final diff')
  .confirm('Review the diff before releasing?', true);

const result = await script.execute({ dryRun, yes });

if (result.aborted)
{
  process.exit(1);
}

console.log(`Release prep complete for v${nextVersion}.`);
