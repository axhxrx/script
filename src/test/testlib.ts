import { test as nodeTest } from 'node:test';

export { expect } from '@std/expect';

type Hook = () => Promise<void> | void;
type TestFn = () => Promise<void> | void;

type SuiteHooks = {
  beforeEach: Hook[];
  afterEach: Hook[];
};

const rootSuite: SuiteHooks = {
  beforeEach: [],
  afterEach: [],
};

const suiteStack: SuiteHooks[] = [rootSuite];
let lastRegisteredTest = Promise.resolve();

function createDeferred(): { promise: Promise<void>; resolve: () => void }
{
  let resolve = () =>
  {
    // Reassigned during promise construction.
  };

  const promise = new Promise<void>((nextResolve) =>
  {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

async function runHooks(hooks: readonly Hook[]): Promise<void>
{
  let firstError: unknown;

  for (const hook of hooks)
  {
    try
    {
      await hook();
    }
    catch (error)
    {
      firstError ??= error;
    }
  }

  if (firstError !== undefined)
  {
    throw firstError;
  }
}

function currentSuite(): SuiteHooks
{
  return suiteStack.at(-1) ?? rootSuite;
}

export function beforeEach(hook: Hook): void
{
  currentSuite().beforeEach.push(hook);
}

export function afterEach(hook: Hook): void
{
  currentSuite().afterEach.push(hook);
}

export function describe(_name: string, definition: () => void): void
{
  const suite: SuiteHooks = {
    beforeEach: [],
    afterEach: [],
  };

  suiteStack.push(suite);
  try
  {
    definition();
  }
  finally
  {
    suiteStack.pop();
  }
}

export function test(name: string, fn: TestFn): void
{
  const suites = [...suiteStack];
  const previousTest = lastRegisteredTest;
  const currentTest = createDeferred();
  lastRegisteredTest = previousTest.then(() => currentTest.promise);

  nodeTest(name, { concurrency: false }, async () =>
  {
    await previousTest;

    const beforeHooks = suites.flatMap((suite) => suite.beforeEach);
    const afterHooks = suites.toReversed().flatMap((suite) => suite.afterEach.toReversed());

    let testError: unknown;

    try
    {
      await runHooks(beforeHooks);
      await fn();
    }
    catch (error)
    {
      testError = error;
    }

    try
    {
      await runHooks(afterHooks);
    }
    catch (error)
    {
      testError ??= error;
    }

    if (testError !== undefined)
    {
      currentTest.resolve();
      throw testError;
    }

    currentTest.resolve();
  });
}
