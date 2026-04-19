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
