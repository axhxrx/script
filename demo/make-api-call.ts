#!/usr/bin/env bun

/**
 Tiny demo program that randomly simulates an API call, to exercise retry-command.

 Exits 0 on success with a JSON payload on stdout. Exits 1 on error with a JSON payload on stderr. Three error types are emitted with different probabilities so `--if` and `--unless` patterns are interesting: `ECONNRESET` (transient network, 30%), `503 Service Unavailable` (transient server, 20%), `401 Unauthorized` (fatal auth, 10%). Success is 40%.

 Examples:

   # Raw demo — run a few times to see the distribution:
   bun demo/makeAPICALL.ts

   # With retry-command: retry transient errors, don't retry 401:
   bun bin/retry-command.ts --max-retries 5 --if ECONNRESET --if 503 --unless 401 'bun demo/makeAPICALL.ts'
 */

import process from 'node:process';

const requestId = `req_${Math.random().toString(36).slice(2, 10)}`;
const timestamp = new Date().toISOString();
const roll = Math.random();

if (roll < 0.4)
{
  console.log(JSON.stringify({
    ok: true,
    data: { user: 'alice', id: 42, balance: 1234.56 },
    requestId,
    timestamp,
  }));
  process.exit(0);
}

let payload: Record<string, unknown>;
if (roll < 0.7)
{
  payload = { ok: false, status: 0, error: 'ECONNRESET: connection reset by peer' };
}
else if (roll < 0.9)
{
  payload = { ok: false, status: 503, error: '503 Service Unavailable' };
}
else
{
  payload = { ok: false, status: 401, error: '401 Unauthorized: invalid credentials' };
}

console.error(JSON.stringify({ ...payload, requestId, timestamp }));
process.exit(1);
