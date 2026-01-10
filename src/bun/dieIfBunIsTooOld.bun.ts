/**
 Returns `false` if Bun version is >= 1.3.3 where `--no-env-file` was fixed. Otherwise returns `true` (which means you need to upgrade!)

 See: https://github.com/oven-sh/bun/issues/5515
 */
export function isBunTooOld() {
  const [major, minor, patch] = Bun.version.split('.').map(Number);
  const bunVersionOk =
    major > 1 ||
    (major === 1 && minor > 3) ||
    (major === 1 && minor === 3 && patch >= 3);
  return !bunVersionOk;
}

/**
 Kills the process if Bun version is too old (< 1.3.3) after printing an error message.
 */
export function dieIfBunIsTooOld() {
  if (isBunTooOld()) {
    console.error(
      `❌ Bun ${Bun.version} has a bug with --no-env-file that causes .env.local to leak.\n` +
        `   This interferes with our build scripts, and can produce a corrupted deployment. Please upgrade: bun upgrade`,
    );
    process.exit(1);
  }
}
