/**
 A single-import workaround for test-runner primitives that enable cross-framework tests that run on Node, Bun, and Deno.

 Rationale:

 - `node:test` works on Node and Bun but Deno's `node:test` shim does not implement `afterEach`/`beforeEach`.

 - `@std/testing/bdd` works on Deno but crashes on Node and Bun with `Deno is not defined`. Neither library is standalone-portable.

 Both modules can be *imported* cleanly under both environments; only specific *calls* fail on the wrong runtime.

 This module picks which implementation to invoke based on a runtime check, so tests can import a single stable surface.

 This is obviously very hacky.  Hopefully, the BDD lib will get fixed and we won't need this anymore. But for now, we do.

 This is intended to be extracted into a published `@axhxrx/test` package once the shape has stabilized.
 */

/**
 Running tests under Node: why `test:node` uses `--test-isolation=none`.

 With Node's default `--test-isolation=process`, each test *file* runs in its own child process. Results are reported back to the parent over a dedicated IPC channel that uses V8's structured-clone serialization inside a length-prefixed frame protocol. The parent deframes those bytes and reconstructs objects for the reporter.

 Under high-volume stdout/stderr — which file-logging tests by definition produce — the framing can desync. Node's runner intercepts stdout and re-emits each chunk as an IPC `:diagnostic` message; if a chunk boundary falls mid-frame, the parent reads the next few bytes as if they were a length header, gets garbage, and V8 refuses the resulting buffer with:

 `Error: Unable to deserialize cloned data due to invalid or unsupported version.`

 The failure is always at the file level and appears AFTER many tests in that file have already passed, because the bug is cumulative — enough high-volume output eventually breaks framing. Individual suites inside the same file pass when run alone. Our `FileLogging.test.ts` (and, once converted, `Script.test.ts`) hit this reliably because they write large volumes of text AND spawn subprocesses whose output flows back through the test process.

 The workaround is `--test-isolation=none`: everything runs in one process, no IPC, no framing, no bug. Trade-offs:

 - Upside: faster for small suites; bug goes away entirely.
 - Downside: globals, `process.argv`, `process.env`, module-level singletons can leak between files; Node also can't parallelize files across cores. We already restore shared state with `beforeEach`/`afterEach` (see `_probe.test.ts`), so this is survivable for us.

 Bun and Deno do not use V8 structured clone for test reporting (Bun runs everything in one process; Deno uses a custom wire format) and are unaffected. CI under `bun test` and `deno test` still validates the real per-file isolation behavior — so we're not giving up that coverage by using `--test-isolation=none` in the Node-only script.

 This is a known upstream Node bug that has had fixes landing incrementally over time. If a future Node version makes the default `--test-isolation=process` reliable under high-volume stdout, drop `--test-isolation=none` from the `test:node` script in `package.json`.
 */

import * as stdBdd from '@std/testing/bdd';
import * as nodeTest from 'node:test';

const isDeno = typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined';

export const describe = isDeno ? stdBdd.describe : nodeTest.describe;
export const test = isDeno ? stdBdd.it : nodeTest.test;
export const it = isDeno ? stdBdd.it : nodeTest.it;
export const beforeEach = isDeno ? stdBdd.beforeEach : nodeTest.beforeEach;
export const afterEach = isDeno ? stdBdd.afterEach : nodeTest.afterEach;
export const before = isDeno ? stdBdd.beforeAll : nodeTest.before;
export const after = isDeno ? stdBdd.afterAll : nodeTest.after;
