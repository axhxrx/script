import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import process from 'node:process';

/**
 Result type for `getFileInfo()`.
 */
export interface FileInfo
{
  name: string;
  content: string;
  hash: string;
  size: number;
}

/**
 Default max file size: 1 GiB. This leaves headroom for typical CI environments like GitHub Actions (7.5GB RAM).
 */
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 1024;

/**
 Get FileInfo for a given file path. Only works for files. Reads the entire file into memory and computes a SHA-256 hash.

 The hash is computed from raw bytes, so it's correct for both text and binary files. The content field is decoded as UTF-8, which works for text files but may produce garbled output for binary files.

 @param filePath - Path to the file
 @param maxSize - Maximum file size in bytes (default: 1 GiB). Set to `Infinity` to disable the check.
 @throws {Error} If the file does not exist, is not readable, or exceeds maxSize.
 */
export function getFileInfo(filePath: string, maxSize = DEFAULT_MAX_FILE_SIZE): FileInfo
{
  const stats = statSync(filePath);
  if (stats.size > maxSize)
  {
    throw new Error(
      `File too large: ${stats.size} bytes exceeds limit of ${maxSize} bytes. `
        + `Pass a larger maxSize parameter to override.`,
    );
  }

  // Read as raw bytes to compute correct hash for both text and binary files
  const buffer = readFileSync(filePath);
  const hash = createHash('sha256').update(buffer).digest('hex');

  // Decode as UTF-8 for content (works for text files, may be garbled for binary)
  const content = buffer.toString('utf-8');

  return {
    name: basename(filePath),
    content,
    hash,
    size: stats.size,
  };
}

if (import.meta.main)
{
  console.log('-> executing ./src/fs/getFileInfo.ts');

  const filePath = process.argv[2];
  if (!filePath)
  {
    console.error('Usage: getFileInfo <filePath>');
    process.exit(1);
  }

  const fileInfo = getFileInfo(filePath);
  console.log(fileInfo);

  console.log('<- executed ./src/fs/getFileInfo.ts');
}
