/* eslint-disable no-console */

/**
 Print a prominent banner to the console.
 */
export function printBanner(text: string): void
{
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${line}`);
  console.log(`║ ${text} ║`);
  console.log(`${line}\n`);
}
