#!/usr/bin/env bun
/**
 Safe deployment skeleton with validations, confirmations, and dry-run support.
 */

import { existsSync } from 'node:fs';
import process from 'node:process';

import { add, banner, execute, runQuiet, validate } from '@axhxrx/script';

validate('On main branch', () =>
{
  const branch = runQuiet('git branch --show-current').trim();
  return branch === 'main' || `Expected to deploy from "main", not "${branch}".`;
});

validate('Working directory is clean', () =>
{
  return runQuiet('git status --porcelain').trim() === '' || 'Commit or stash your changes first.';
});

validate('package.json exists', () =>
{
  return existsSync('package.json') || 'Run this from a package root.';
});

banner('Deploy Plan');

add('echo "Run test suite"')
  .description('Run tests');

add('echo "Build production bundle"')
  .description('Build');

add('echo "Deploy to production"')
  .description('Deploy')
  .confirm('Pretend to deploy to production?', true);

banner('Post Deploy');

add(() =>
{
  console.log(`Latest commit: ${runQuiet('git log -1 --oneline').trim()}`);
}).description('Summarize release candidate');

add('git diff --stat')
  .description('Review final diff');

const result = await execute();

if (result.aborted)
{
  process.exit(1);
}

console.log(`Done! Ran ${result.stepsRun} top-level step(s).`);
