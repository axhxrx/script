# @axhxrx/script

This is a utility library for using TypeScript to replace shell scripts.

## Why shell scripts make you die

Shell scripts ae great, until they suck. They're easy to get started with — just add some commands! But as soon as you need an `if` or a `loop` you begin the descent into madness. Five seconds later, you are staring at:

```shell
VAL=$(grep -o '"'"$1"'":"[^"]*"' file.json | sed 's/"'"$1"'":"\([^"]*\)"/\1/') && [ -n "$VAL" ] && export "$1"="$VAL" || export "$1"="${2:-$(cat /dev/stdin 2>/dev/null || echo '')}"
```

Shell scripts are like baby pythons. Cute when little, but they live a long time, tend to keep growing, and finally crush you to death in your sleep.

## So why not TypeScript?

99% of shell scripts written since 2020 shouldn't have been. But old habits die hard. Also, even with Deno and Bun arriving on the scene, TypeScript isn't exactly pithy for scripts that mostly just execute commands.

I mean, which is better:

```shell
hostname=$(hostname)
```

vs

```typescript
try {
  const result = execSync("hostname", {
    cwd: options.cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });
  return typeof result === "string" ? result.trim() : "";
} catch (error: unknown) {
  return "";
}
```

You can pretty easily write a couple functions to make that more pleasant, but for the "zero to executing a couple shell commands", TypeScript hasn't always given us ergonmic ways to do it out of the box.

[Bun Shell](https://bun.com/docs/runtime/shell) is actually pretty great, and if you are OK with Bun only, it might be a better alternative to this library is.

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
const s = new Script();
s.add(`
  deno check
  deno lint
  bun test
  dprint fmt **/*.ts
`);
await s.execute();
```

That's gonna do just what you expect. But when you inevitably start to need conditional logic, both during execution and maybe also to _decide_ what to execute, there are a few more benefits.

```ts

```

## history

🎅 2026-01-11: release 1.0.0

🤖 2025-12-26: repo initialized by Bottie McBotface bot@axhxrx.com
