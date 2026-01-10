import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
}

/**
 Get FileInfo for a given file path. Only works for files. Reads the entire file into memory and computes a SHA-256 hash, so not intended for large files. (We'll probably never need that, but if we do, implement it separately.)

 @throws {Error} If the file does not exist or is not a file or is not readable.
 */
export function getFileInfo(filePath: string): FileInfo
{
  const content = readFileSync(filePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');

  return {
    name: basename(filePath),
    content,
    hash,
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
