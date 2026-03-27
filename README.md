# @axhxrx/script

This is a utility library for using TypeScript instead of shell scripts. It's not as lovable as [Bun Shell](https://bun.com/docs/runtime/shell) , but it works on modern TypeScript runtimes, including Node.js 24+.

## TL;DR

```ts

```

## Why shell scripts make you die

Shell scripts are great, until they suck. They're easy to get started with — just add some commands! But as soon as you need an `if` or a `loop` you begin the descent into madness. Five seconds later, you are staring at:

```shell
VAL=$(grep -o '"'"$1"'":"[^"]*"' file.json | sed 's/"'"$1"'":"\([^"]*\)"/\1/') && [ -n "$VAL" ] && export "$1"="$VAL" || export "$1"="${2:-$(cat /dev/stdin 2>/dev/null || echo '')}"
```

Shell scripts are like baby pythons. 🐍 Cute when little, but they tend to live a long time, keep growing, and finally crush you to death in your sleep and then swallow your corpse whole.

## So why not TypeScript?

I **_know_**, right? 99.164% of shell scripts written since 2020 _shouldn't have been_. But old habits die hard. Also, out of the box, runtime-agnostic TypeScript isn't exactly _pithy_ for scripts that mostly just execute commands.

I mean, which is better:

```shell
hostname=$(hostname)
```

vs

```typescript
let hostname: string;
try {
  const result = execSync("hostname", {
    encoding: "utf-8",
    stdio: "pipe",
  });
  hostname = result.trim();
} catch (error: unknown) {
  hostname = "";
}
```

You can easily write a couple functions to make that more pleasant, but for the "zero to executing a couple shell commands", TypeScript hasn't always given us ergonmic ways to do it.

[Bun Shell](https://bun.com/docs/runtime/shell) is actually pretty great, and if you are OK with Bun-only, it's probably a better alternative to shell scripts than this library is.

## But this library is just modern TypeScript

Not as cute and concise as Bun Shell, but it works on modern runtimes, and even less-modern runtimes like Node.js 24+.

The point is to just make it more ergonomic to write your build scripts and deploy scripts and whatever scripts in TypeScript, and never write another shell script again.

### Simplest example:

```ts
import { add, execute } from "@axhxrx/script";

add("deno check");
add("deno lint");
add("bun test");
add("dprint fmt **/*.ts");

await execute();
```

Or, if you prefer:

```ts
const steps = `
  deno check
  deno lint 
  bun test
  dprint fmt **/*.ts
  `;
add(steps);
await execute({ yes: true });
```

Or, if you are a bona-fide O.G. radguy warez kingpin, and you love OOP:

```ts
import { Script } from "@axhxrx/script";

const s = new Script();
s.add(`
  deno check
  deno lint
  bun test
  dprint fmt **/*.ts
`);
await s.execute();
```

Those are all equivalent, and it's obvious at a glance what this script code will do.

Before doing it, though, by default that code will confirm the plan before executing it:

```shell
📋 Execution Plan

  1. deno check
  2. deno lint
  3. bun test
  4. dprint fmt **/*.ts

Total: 4 steps

Proceed with execution? [Y/n]:
```

Use `execute({ yes: true });` to skip the confirmation. Or use `execute({parseArgs: true})` to use the built-in support for parsing `--yes` or `-y` from the command line args. (That also gives you automatic support for `--dry-run`)

OK, fine. But the above still isn't really any better than this `bash` script:

```bash
deno check
deno lint
bun test
dprint fmt **/*.ts
```

So, what's the point? Well, the benefits of this library start to make themselves apparent when you need to add conditional logic, both during execution and maybe also to _decide_ what to execute. Or add pre-flight validation steps. Or make some steps conditional based on the results of previous steps. Or support standard things like `--dry-run` or `-y` arguments.

### if and else, pre-flight validation, and builder pattern

```ts
// add() just adds steps to the plan, they won't
// run until you call execute(). So you can use
// if/else to conditionally add steps, without
// ending up with partially executed steps.

if (args.gcloudAuth) {
  banner("🔐 AUTHENTICATE WITH GCLOUD");

  // steps can be modified via builder-pattern methods:
  add("gcloud auth login")
    .description("Authenticate with gcloud")
    .interactive()
    .onError("warn");
    .cwd('~')
    .confirm("⚠️ May cause computer explosion. Are you sure?", true)
    .canSkip(false)
    .validate(() => {
      return doSomething();
    });
}
```

| Method           | Description                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.description()` | Optional user-friendly description shows up when executing, in addition to the raw command                               |
| `.interactive()` | Inherit stdin so the user can type in the auth code                                                                      |
| `.onError()`     | User might cancel this step, it's ok, don't quit                                                                         |
| `.cwd()`         | Set cwd for this step                                                                                                    |
| `.confirm()`     | Optional per-step confirmation for dangerous steps                                                                       |
| `.canSkip()`     | Should execution keep going even if confirm() answer is no?                                                              |
| `.validate()`    | Step-level validation executes right before the step is executed (and thus can depend on the results of previous steps). |

```ts
// You can also schedule script-level validations any time before calling execute(). All validations run before any steps are executed. This is for pre-flight sanity-checking.
validate(async () => {
  const somebody = await mainScreenTurnOn();
  return !somebody.seUpUsTheBomb; // we're good to go
});
```

### use TypeScript functions interchangeably with shell commands

```ts
add(`echo "Working in $(pwd)..."`);

// Inline function step:
add(() => {
  const branch =
    runQuiet("git branch --show-current").trim() || "(detached HEAD)";
  console.log(`Branch: ${branch}`);
}).description("Show current branch");

// Named function step:
add(summarizeLocalChanges).description("Summarize local changes");

add("git log --oneline -3").description("Show recent commits");

await execute({ parseArgs: true });
```

## Installation

```bash
# Bun
bunx jsr add @axhxrx/op

# pnpm
pnpm i jsr:@axhxrx/op

# npm
npx jsr add @axhxrx/op

# Deno
deno add jsr:@axhxrx/op
```

With Deno, you can alternatively just import it from JSR _without_ adding it to your project (cool):

```ts
import * as script from "jsr:@axhxrx/op";
```

## Runtime Notes

- Node.js support target is 24+.
- Live command-output capture uses a `bash` + `tee` pipeline.
- If `bash` or `tee` is not available on `PATH`, Unix capture/file logging will fail with an explicit error.

## history

🎅 2026-03-28: release 1.0.0

🤖 2025-12-26: repo initialized by Bottie McBotface bot@axhxrx.com
