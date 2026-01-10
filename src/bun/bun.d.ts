/**
 Minimal Bun type declarations for Deno compatibility.

 This allows `deno check` to pass on .bun.ts files that use Bun-specific APIs.
 These files are only intended to run under Bun, but we want type checking to work in the monorepo.
 */
declare const Bun: {
  version: string
}
