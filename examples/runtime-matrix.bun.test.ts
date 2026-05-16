import { test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

type Runtime = {
  args: string[];
  command: string;
  name: string;
};

type ExampleCase = {
  args: string[];
  expectedText: string;
  file: string;
  input?: string;
};

const projectRoot = join(import.meta.dir, '..');
const leakedArtifacts = ['notes.txt', 'release-notes.md'];

const runtimes: Runtime[] = [
  { name: 'Node', command: 'node', args: [] },
  { name: 'Deno', command: 'deno', args: ['run', '-A'] },
  { name: 'Bun', command: 'bun', args: [] },
];

const examples: ExampleCase[] = [
  {
    file: '01-basic.ts',
    args: ['--dry-run'],
    expectedText: 'Hello from @axhxrx/script',
  },
  {
    file: '02-builder-pattern.ts',
    args: ['--yes'],
    expectedText: 'Builder Pattern Example Demo',
  },
  {
    file: '03-validations.ts',
    args: ['--yes'],
    expectedText: 'All validations passed.',
  },
  {
    file: '04-function-steps.ts',
    args: ['--yes'],
    expectedText: 'Repository Summary',
  },
  {
    file: '05-file-logging.ts',
    args: ['--yes'],
    expectedText: 'Command log:',
  },
  {
    // --skip-validations: this example has a "working directory clean"
    // validation that would (correctly) fail when tests run against a
    // dirty working tree. We're only verifying the example executes
    // end-to-end here, so skipping validations is appropriate.
    file: '06-deploy-skeleton.ts',
    args: ['--dry-run', '--skip-validations'],
    expectedText: 'Deploy Plan',
  },
  {
    file: '07-create-script.ts',
    args: ['build', '--dry-run'],
    expectedText: 'Build Script',
  },
  {
    // --skip-validations: this example has a "working directory clean"
    // validation that would (correctly) fail when tests run against a
    // dirty working tree. We're only verifying the example executes
    // end-to-end here, so skipping validations is appropriate.
    file: '08-release-prep.ts',
    args: ['--dry-run', '--skip-validations'],
    expectedText: 'Release prep complete',
  },
];

function cleanupLeakedArtifacts()
{
  for (const file of leakedArtifacts)
  {
    rmSync(join(projectRoot, file), { force: true });
  }
}

function assertNoLeakedArtifacts(context: string)
{
  const leaked = leakedArtifacts.filter((file) => existsSync(join(projectRoot, file)));

  if (leaked.length > 0)
  {
    throw new Error(`${context} leaked scratch files into the repo root: ${leaked.join(', ')}`);
  }
}

function runExample(runtime: Runtime, example: ExampleCase)
{
  cleanupLeakedArtifacts();

  const command = [
    runtime.command,
    ...runtime.args,
    `examples/${example.file}`,
    ...example.args,
  ];

  const [executable, ...restArgs] = command;
  if (!executable)
  {
    throw new Error(`empty command array for ${runtime.name}`);
  }
  const result = spawnSync(executable, restArgs, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    input: example.input,
    timeout: 30_000,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const label = `${runtime.name} -> ${example.file}`;

  try
  {
    if (result.error)
    {
      throw new Error(`${label} failed to start: ${result.error.message}\n\n${output}`);
    }

    if (result.status !== 0)
    {
      throw new Error(`${label} exited with code ${result.status}\n\n$ ${command.join(' ')}\n\n${output}`);
    }

    if (!output.includes(example.expectedText))
    {
      throw new Error(
        `${label} did not print expected text: ${JSON.stringify(example.expectedText)}\n\n$ ${
          command.join(' ')
        }\n\n${output}`,
      );
    }

    assertNoLeakedArtifacts(label);
  }
  finally
  {
    cleanupLeakedArtifacts();
  }
}

test('examples run under Node, Deno, and Bun', () =>
{
  for (const runtime of runtimes)
  {
    for (const example of examples)
    {
      runExample(runtime, example);
    }
  }
});
