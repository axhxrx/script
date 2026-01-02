#!/usr/bin/env -S deno run --no-config -A
/**
 * Push an exported monorepo subset to a deployment repository.
 *
 * This script stages only the files that EXIST in the current directory
 * (ignoring deleted/missing files), commits them, and pushes to a specified
 * remote repository. This is useful for deploying a monorepo subset to
 * services that deploy on commit to main (Deno Deploy, Vercel, etc.).
 *
 * Usage:
 *   deno run -A script/push-export.ts <repo-url> [options]
 *
 * Example:
 *   # Push to a deployment repo
 *   deno run -A script/push-export.ts https://github.com/myorg/my-deploy-repo.git
 *
 *   # With custom commit message and branch
 *   deno run -A script/push-export.ts https://github.com/myorg/my-deploy-repo.git \
 *     --message="Deploy auth service" --branch=main
 *
 * Options:
 *   --message=<msg>   Commit message (default: "Deploy from monorepo export")
 *   --branch=<name>   Branch to push to (default: main)
 *   --force           Force push (use with caution)
 *   --dry-run         Show what would happen without actually doing it
 *   --help            Show this help message
 *
 * Typical workflow:
 *   1. Export monorepo subset: deno run -A script/export-monorepo.ts auth.axhxrx.com sso
 *   2. cd to the export directory
 *   3. Push to deploy repo: deno run -A ../script/push-export.ts <repo-url>
 */

import { parseArgs } from 'jsr:@std/cli@^1.0.17/parse-args'

interface PushOptions
{
  repoUrl: string
  message: string
  branch: string
  force: boolean
  dryRun: boolean
}

async function main(): Promise<void>
{
  const args = parseArgs(Deno.args, {
    string: ['message', 'branch'],
    boolean: ['force', 'dry-run', 'help'],
    default: {
      message: 'Deploy from monorepo export',
      branch: 'main',
      force: false,
      'dry-run': false,
    },
  })

  if (args.help)
  {
    printHelp()
    Deno.exit(0)
  }

  // Get repo URL from positional arguments
  const repoUrl = args._[0] as string | undefined

  if (!repoUrl)
  {
    console.error('Error: Repository URL is required.')
    console.error('Run with --help for usage information.')
    Deno.exit(1)
  }

  const options: PushOptions = {
    repoUrl: String(repoUrl),
    message: args.message!,
    branch: args.branch!,
    force: args.force,
    dryRun: args['dry-run'],
  }

  await pushExport(options)
}

async function pushExport(options: PushOptions): Promise<void>
{
  const { repoUrl, message, branch, force, dryRun } = options

  // Verify we're in a git repository
  const gitDirExists = await fileExists('.git')
  if (!gitDirExists)
  {
    console.error('Error: Not in a git repository. Run this from an exported monorepo directory.')
    Deno.exit(1)
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Push Export to Deploy Repo                         │
├─────────────────────────────────────────────────────┤
│  Target:  ${repoUrl.slice(0, 40).padEnd(40)}│
│  Branch:  ${branch.padEnd(40)}│
│  Force:   ${String(force).padEnd(40)}│
│  Dry Run: ${String(dryRun).padEnd(40)}│
└─────────────────────────────────────────────────────┘
`)

  // Step 1: Add the deploy remote (or update it)
  console.log('🔗 Setting up deploy remote...')
  if (!dryRun)
  {
    // Remove existing deploy remote if it exists
    await runCommand(['git', 'remote', 'remove', 'deploy'], { ignoreError: true })
    // Add new deploy remote
    const addResult = await runCommand(['git', 'remote', 'add', 'deploy', repoUrl])
    if (!addResult.success)
    {
      console.error('Failed to add deploy remote:', addResult.stderr)
      Deno.exit(1)
    }
  }
  else
  {
    console.log(`   Would run: git remote add deploy ${repoUrl}`)
  }

  // Step 2: Stage only existing files (not deleted ones)
  // Using "git add ." stages new and modified files, but NOT deleted files
  console.log('📦 Staging existing files...')
  if (!dryRun)
  {
    const addResult = await runCommand(['git', 'add', '.'])
    if (!addResult.success)
    {
      console.error('Failed to stage files:', addResult.stderr)
      Deno.exit(1)
    }
  }
  else
  {
    console.log('   Would run: git add .')
  }

  // Step 3: Show what's staged
  console.log('\n📋 Staged changes:')
  const statusResult = await runCommand(['git', 'status', '--short'])
  if (statusResult.stdout)
  {
    // Filter to only show staged changes (start with M, A, etc. in first column)
    const lines = statusResult.stdout.split('\n').filter(line =>
    {
      // Staged changes have a non-space character in the first column
      return line.length > 0 && line[0] !== ' ' && line[0] !== '?'
    })
    if (lines.length > 0)
    {
      for (const line of lines.slice(0, 20))
      {
        console.log(`   ${line}`)
      }
      if (lines.length > 20)
      {
        console.log(`   ... and ${lines.length - 20} more files`)
      }
    }
    else
    {
      console.log('   No changes to commit')
      return
    }
  }

  // Step 4: Commit
  console.log(`\n💾 Committing with message: "${message}"`)
  if (!dryRun)
  {
    const commitResult = await runCommand(['git', 'commit', '-m', message])
    if (!commitResult.success)
    {
      // Check if it's just "nothing to commit"
      if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit'))
      {
        console.log('   No changes to commit')
        return
      }
      console.error('Failed to commit:', commitResult.stderr)
      Deno.exit(1)
    }
  }
  else
  {
    console.log(`   Would run: git commit -m "${message}"`)
  }

  // Step 5: Push to deploy remote
  const pushCmd = ['git', 'push', 'deploy', `HEAD:${branch}`]
  if (force)
  {
    pushCmd.push('--force')
  }

  console.log(`\n🚀 Pushing to ${repoUrl} (branch: ${branch})...`)
  if (!dryRun)
  {
    const pushResult = await runCommand(pushCmd, { stream: true })
    if (!pushResult.success)
    {
      console.error('\n❌ Push failed!')
      console.error('Hint: You may need --force if the remote has diverged')
      Deno.exit(1)
    }
  }
  else
  {
    console.log(`   Would run: ${pushCmd.join(' ')}`)
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  ✅ Push Complete!                                  │
├─────────────────────────────────────────────────────┤
│  Your deployment repo should now trigger a deploy.  │
└─────────────────────────────────────────────────────┘
`)
}

async function fileExists(path: string): Promise<boolean>
{
  try
  {
    await Deno.stat(path)
    return true
  }
  catch
  {
    return false
  }
}

interface RunCommandOptions
{
  ignoreError?: boolean
  stream?: boolean
}

async function runCommand(
  cmd: string[],
  options?: RunCommandOptions,
): Promise<{ success: boolean; stdout: string; stderr: string }>
{
  try
  {
    if (options?.stream)
    {
      const command = new Deno.Command(cmd[0], {
        args: cmd.slice(1),
        stdout: 'inherit',
        stderr: 'inherit',
      })
      const { success } = await command.output()
      return { success, stdout: '', stderr: '' }
    }

    const command = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: 'piped',
      stderr: 'piped',
    })

    const { success, stdout, stderr } = await command.output()

    return {
      success,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    }
  }
  catch (error)
  {
    if (options?.ignoreError)
    {
      return { success: true, stdout: '', stderr: '' }
    }
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    }
  }
}

function printHelp(): void
{
  console.log(`
Push Export - Push monorepo subset to a deployment repository

Stages only EXISTING files (ignoring deleted/missing subprojects),
commits them, and pushes to a specified remote. This enables
deploy-on-push workflows for services like Deno Deploy, Vercel, etc.

USAGE:
  deno run -A script/push-export.ts <repo-url> [OPTIONS]

ARGUMENTS:
  <repo-url>         Git repository URL to push to
                     (e.g., https://github.com/myorg/deploy-repo.git)

OPTIONS:
  --message=<msg>    Commit message
                     (default: "Deploy from monorepo export")

  --branch=<name>    Branch to push to (default: main)

  --force            Force push (overwrites remote history)

  --dry-run          Show what would happen without doing it

  --help             Show this help message

EXAMPLES:
  # Basic usage - push to a deploy repo
  deno run -A script/push-export.ts https://github.com/myorg/auth-deploy.git

  # Custom commit message
  deno run -A script/push-export.ts https://github.com/myorg/auth-deploy.git \\
    --message="Release v1.2.3"

  # Push to a different branch
  deno run -A script/push-export.ts https://github.com/myorg/auth-deploy.git \\
    --branch=production

  # Force push (use with caution!)
  deno run -A script/push-export.ts https://github.com/myorg/auth-deploy.git --force

  # Dry run to see what would happen
  deno run -A script/push-export.ts https://github.com/myorg/auth-deploy.git --dry-run

TYPICAL WORKFLOW:
  1. Export monorepo subset:
     deno run -A script/export-monorepo.ts auth.axhxrx.com sso --output=/tmp/deploy

  2. Change to export directory:
     cd /tmp/deploy

  3. Push to deployment repo:
     deno run -A /path/to/script/push-export.ts https://github.com/myorg/auth-deploy.git

  This will trigger a deploy on services configured to deploy on push to main.

NOTES:
  - Must be run from within a git repository (the exported monorepo)
  - Only stages existing files, not the "deleted" subprojects
  - The commit is made on top of the current HEAD
  - Uses 'deploy' as the remote name (overwrites if exists)
`)
}

// Run main
main().catch((err) =>
{
  console.error('Fatal error:', err)
  Deno.exit(1)
})
