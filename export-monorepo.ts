#!/usr/bin/env -S deno run --no-config -A
/**
 * Export a subset of the monorepo to a new directory.
 *
 * This script creates a copy of the monorepo containing only the specified
 * subprojects, with a rewritten deno.jsonc that only includes those subprojects
 * in the workspace array. The .git folder is preserved so the export is a valid
 * git working copy.
 *
 * Usage:
 *   deno run -A script/export-monorepo.ts <subproject1> <subproject2> ...
 *
 * Example:
 *   deno run -A script/export-monorepo.ts auth.axhxrx.com sso internationalization
 *
 * Options:
 *   --output=<path>   Output directory (default: /tmp/monorepo-export-<timestamp>)
 *   --no-git          Don't copy the .git folder
 *   --help            Show this help message
 *
 * Must be run from the monorepo root.
 */

import { parseArgs } from 'jsr:@std/cli@^1.0.17/parse-args'
import { copy } from 'jsr:@std/fs@^1.0.21/copy'
import { exists } from 'jsr:@std/fs@^1.0.21/exists'
import { parse as parseJSONC } from 'jsr:@std/jsonc@^1.0.2'

interface ExportOptions
{
  subprojects: string[]
  outputDir: string
  copyGit: boolean
  dryRun: boolean
}

async function main(): Promise<void>
{
  const args = parseArgs(Deno.args, {
    string: ['output'],
    boolean: ['no-git', 'dry-run', 'help'],
    default: {
      'no-git': false,
      'dry-run': false,
    },
  })

  if (args.help)
  {
    printHelp()
    Deno.exit(0)
  }

  // Get subprojects from positional arguments
  const subprojects = args._ as string[]

  if (subprojects.length === 0)
  {
    console.error('Error: At least one subproject must be specified.')
    console.error('Run with --help for usage information.')
    Deno.exit(1)
  }

  // Determine output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = args.output ?? `/tmp/monorepo-export-${timestamp}`

  const options: ExportOptions = {
    subprojects: subprojects.map(String),
    outputDir,
    copyGit: !args['no-git'],
    dryRun: args['dry-run'],
  }

  await exportMonorepo(options)
}

async function exportMonorepo(options: ExportOptions): Promise<void>
{
  const { subprojects, outputDir, copyGit, dryRun } = options
  const monorepoRoot = Deno.cwd()

  // Verify we're in the monorepo root (check for deno.jsonc with workspace)
  const rootConfigPath = `${monorepoRoot}/deno.jsonc`
  if (!(await exists(rootConfigPath)))
  {
    console.error('Error: deno.jsonc not found. Must be run from the monorepo root.')
    Deno.exit(1)
  }

  // Validate that all specified subprojects exist
  const missingSubprojects: string[] = []
  for (const subproject of subprojects)
  {
    if (!(await exists(`${monorepoRoot}/${subproject}`)))
    {
      missingSubprojects.push(subproject)
    }
  }

  if (missingSubprojects.length > 0)
  {
    console.error(`Error: The following subprojects do not exist:`)
    for (const missing of missingSubprojects)
    {
      console.error(`  - ${missing}`)
    }
    Deno.exit(1)
  }

  // Read and parse the root deno.jsonc
  const rootConfigContent = await Deno.readTextFile(rootConfigPath)
  const rootConfig = parseJSONC(rootConfigContent)

  if (typeof rootConfig !== 'object' || rootConfig === null)
  {
    console.error('Error: Invalid deno.jsonc file')
    Deno.exit(1)
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Monorepo Export                                    │
├─────────────────────────────────────────────────────┤
│  Subprojects: ${subprojects.length.toString().padEnd(36)}│
│  Output:      ${outputDir.slice(0, 36).padEnd(36)}│
│  Copy .git:   ${String(copyGit).padEnd(36)}│
│  Dry Run:     ${String(dryRun).padEnd(36)}│
└─────────────────────────────────────────────────────┘
`)

  console.log('Subprojects to export:')
  for (const subproject of subprojects)
  {
    console.log(`  - ${subproject}`)
  }
  console.log('')

  // Step 1: Create output directory
  console.log(`📁 Creating output directory: ${outputDir}`)
  if (!dryRun)
  {
    await Deno.mkdir(outputDir, { recursive: true })
  }

  // Step 2: Copy .git folder if requested
  if (copyGit)
  {
    const gitSrc = `${monorepoRoot}/.git`
    const gitDest = `${outputDir}/.git`
    console.log(`📂 Copying .git folder...`)
    if (!dryRun)
    {
      await copy(gitSrc, gitDest, { overwrite: true })
    }
  }

  // Step 3: Copy subprojects
  for (const subproject of subprojects)
  {
    const src = `${monorepoRoot}/${subproject}`
    const dest = `${outputDir}/${subproject}`
    console.log(`📦 Copying ${subproject}...`)
    if (!dryRun)
    {
      await copy(src, dest, { overwrite: true })
    }
  }

  // Step 4: Create modified deno.jsonc with only specified subprojects in workspace
  const newConfig = {
    ...rootConfig,
    workspace: subprojects,
  }

  const newConfigPath = `${outputDir}/deno.jsonc`
  console.log(`📝 Creating deno.jsonc with workspace: [${subprojects.join(', ')}]`)
  if (!dryRun)
  {
    await Deno.writeTextFile(newConfigPath, JSON.stringify(newConfig, null, 2))
  }

  // Step 5: Copy other root-level files that might be needed
  const rootFilesToCopy = [
    '.gitmodules',
    '.gitignore',
    'dprint.jsonc',
    'AGENTS.md',
    'CLAUDE.md',
  ]

  for (const file of rootFilesToCopy)
  {
    const src = `${monorepoRoot}/${file}`
    const dest = `${outputDir}/${file}`
    if (await exists(src))
    {
      console.log(`📄 Copying ${file}...`)
      if (!dryRun)
      {
        await Deno.copyFile(src, dest)
      }
    }
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  ✅ Export Complete!                                │
└─────────────────────────────────────────────────────┘
`)

  // Print the output path (this is the main output for scripting)
  console.log(outputDir)
}

function printHelp(): void
{
  console.log(`
Monorepo Export Script

Creates a copy of the monorepo containing only specified subprojects,
with a rewritten deno.jsonc workspace array.

USAGE:
  deno run -A script/export-monorepo.ts [OPTIONS] <subproject1> [subproject2] ...

ARGUMENTS:
  <subproject>     Name of subproject directory to include (can specify multiple)

OPTIONS:
  --output=<path>  Output directory path
                   (default: /tmp/monorepo-export-<timestamp>)

  --no-git         Don't copy the .git folder
                   (by default, .git is copied so export is a valid git repo)

  --dry-run        Show what would happen without actually copying

  --help           Show this help message

EXAMPLES:
  # Export auth.axhxrx.com with its dependencies
  deno run -A script/export-monorepo.ts auth.axhxrx.com sso internationalization

  # Export to a specific directory
  deno run -A script/export-monorepo.ts --output=/tmp/my-export ops signtime-import

  # Export without .git folder
  deno run -A script/export-monorepo.ts --no-git auth.axhxrx.com sso

  # Dry run to see what would be copied
  deno run -A script/export-monorepo.ts --dry-run blanch cmd jsonc

NOTES:
  - Must be run from the monorepo root
  - The .git folder is copied by default, making the export a valid git working copy
  - The workspace array in deno.jsonc is rewritten to only include exported subprojects
  - Root-level config files (.gitmodules, .gitignore, etc.) are also copied
`)
}

// Run main
main().catch((err) =>
{
  console.error('Fatal error:', err)
  Deno.exit(1)
})
