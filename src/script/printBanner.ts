/* eslint-disable no-console */

import process from 'node:process';

import type { OutputContext } from './OutputContext.ts';
import { defaultOutputContext } from './OutputContext.ts';

/**
 Get the display width of a string, accounting for wide characters (emoji, CJK, etc.).

 This is a best-effort implementation that handles common cases:
 - Emoji (most are width 2)
 - CJK characters (width 2)
 - Japanese Hiragana/Katakana (width 2)
 - Skin tone modifiers, ZWJ sequences (width 0)
 - Regular ASCII/Latin (width 1)

 **Terminal Rendering Warning:** Emoji rendering is notoriously inconsistent across terminals. This implementation works correctly in iTerm2 and most modern terminals, but VS Code's integrated terminal (and others) may render emoji sequences differently, causing misalignment. This is a terminal rendering issue, not a calculation issue.

 For production use cases requiring precise alignment across all terminals, consider using the `string-width` npm package, or avoiding emoji in banners altogether.
 */
function getDisplayWidth(text: string): number
{
  let width = 0;
  for (const char of text)
  {
    const code = char.codePointAt(0) ?? 0;

    // Zero-width characters (modifiers that combine with previous char)
    if (
      (code >= 0x1F3FB && code <= 0x1F3FF) // Skin tone modifiers
      || (code >= 0xFE00 && code <= 0xFE0F) // Variation selectors
      || code === 0x200D // Zero Width Joiner (ZWJ)
      || code === 0x200B // Zero Width Space
      || (code >= 0x0300 && code <= 0x036F) // Combining diacritical marks
    )
    {
      // These don't add to display width
      continue;
    }

    // Emoji ranges (simplified - covers most common emoji)
    if (
      (code >= 0x1F300 && code <= 0x1F9FF) // Misc Symbols, Emoticons, etc.
      || (code >= 0x2600 && code <= 0x26FF) // Misc Symbols
      || (code >= 0x2700 && code <= 0x27BF) // Dingbats
      || (code >= 0x1F600 && code <= 0x1F64F) // Emoticons
      || (code >= 0x1F680 && code <= 0x1F6FF) // Transport/Map
      || (code >= 0x1F1E0 && code <= 0x1F1FF) // Flags (regional indicators)
    )
    {
      width += 2;
    }
    // CJK and Japanese kana ranges
    else if (
      (code >= 0x4E00 && code <= 0x9FFF) // CJK Unified Ideographs
      || (code >= 0x3400 && code <= 0x4DBF) // CJK Extension A
      || (code >= 0x3000 && code <= 0x303F) // CJK Punctuation
      || (code >= 0x3040 && code <= 0x309F) // Hiragana
      || (code >= 0x30A0 && code <= 0x30FF) // Katakana
      || (code >= 0xFF00 && code <= 0xFFEF) // Fullwidth Forms
      || (code >= 0xAC00 && code <= 0xD7AF) // Hangul Syllables
    )
    {
      width += 2;
    }
    else
    {
      width += 1;
    }
  }
  return width;
}

/**
 Print a prominent banner to the console.

 @param text - The text to display in the banner
 @param ctx - Optional OutputContext for routing output (defaults to terminal)
 */
export function printBanner(text: string, ctx: OutputContext = defaultOutputContext): void
{
  const width = getDisplayWidth(text);
  const line = '═'.repeat(width + 4);
  ctx.log(`\n${line}`);
  ctx.log(`║ ${text} ║`);
  ctx.log(`${line}`);
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/printBanner.ts');

  // Test getDisplayWidth calculations
  const testCases: Array<[string, number]> = [
    ['hello', 5], // ASCII: 5 chars = 5 width
    ['🚀', 2], // Single emoji = 2 width
    ['🚀🎉', 4], // Two emoji = 4 width
    ['日本語', 6], // 3 CJK ideographs = 6 width
    ['テスト', 6], // 3 Katakana = 6 width
    ['ひらがな', 8], // 4 Hiragana = 8 width
    ['👩🏻', 2], // Woman + skin tone = 2 width (modifier is 0)
    ['👨🏽‍💻', 4], // Man + skin + ZWJ + laptop = 4 width (ZWJ is 0)
    ['hello🚀', 7], // 5 ASCII + 1 emoji = 7 width
    ['A你B', 4], // 2 ASCII + 1 CJK = 4 width
    ['', 0], // Empty string = 0 width
    ['Mix: 你好 🎉 World', 18], // 11 ASCII + 2 CJK + 1 emoji + spaces
  ];

  let passed = 0;
  let failed = 0;

  for (const [input, expected] of testCases)
  {
    const actual = getDisplayWidth(input);
    if (actual === expected)
    {
      console.log(`✓ "${input}" → ${actual}`);
      passed++;
    }
    else
    {
      console.log(`✗ "${input}" → ${actual} (expected ${expected})`);
      failed++;
    }
  }

  console.log(`\ngetDisplayWidth tests: ${passed} passed, ${failed} failed\n`);

  // Visual test: banners should have aligned box characters
  console.log('Visual alignment test (boxes should be closed properly):');
  printBanner('Test Banner');
  printBanner('🚀 Deploying');
  printBanner('日本語テスト');
  printBanner('Mix: 你好 🎉 World');
  printBanner('👩🏻 Developer');
  printBanner('👨🏽‍💻 Coding');

  console.log('<- executed ./src/script/printBanner.ts');

  if (failed > 0)
  {
    process.exit(1);
  }
}
