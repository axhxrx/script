#!/usr/bin/env bun
/**
A more realistic example: a deployment script with validations, confirmations, and multiple steps.

This demonstrates how Script can be used for real-world automation tasks.
*/

import process from 'node:process';

import { add, banner, execute, runQuiet, validate } from '@axhxrx/script';

const DEPLOY_BRANCH = 'main';

// Validations that run before anything else
validate('On correct branch', () =>
{
  const branch = runQuiet('git branch --show-current').trim();
  if (branch !== DEPLOY_BRANCH)
  {
    return `Must be on '${DEPLOY_BRANCH}' branch to deploy. Currently on '${branch}'.`;
  }
  return true;
});

validate('Working directory is clean', () =>
{
  const status = runQuiet('git status --porcelain').trim();
  if (status !== '')
  {
    return 'Working directory has uncommitted changes. Commit or stash them first.';
  }
  return true;
});

validate('Up to date with remote', () =>
{
  // Fetch latest
  runQuiet('git fetch origin');
  const behind = runQuiet(`git rev-list HEAD..origin/${DEPLOY_BRANCH} --count`).trim();
  if (behind !== '0')
  {
    return `Local branch is ${behind} commit(s) behind origin. Please pull first.`;
  }
  return true;
});

// The actual deployment steps
banner('🚀 Deployment');

add('echo "Step 1: Running tests..."')
  .description('Run test suite');

add('echo "Step 2: Building for production..."')
  .description('Production build');

add('echo "Step 3: Deploying to production..."')
  .description('Deploy')
  .confirm('⚠️  Ready to deploy to PRODUCTION?');

banner('📋 Post-Deploy');

add('echo "Step 4: Verifying deployment..."')
  .description('Health check');

add('echo "Step 5: Sending notifications..."')
  .description('Notify team');

// Execute with dry-run support
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun)
{
  console.log('🔍 DRY RUN MODE - No commands will be executed\n');
}

const result = await execute({ dryRun });

if (result.aborted)
{
  console.error('\n❌ Deployment was aborted!');
  process.exit(1);
}

console.log(`\n✅ Deployment completed! Ran ${result.stepsRun} steps.`);
