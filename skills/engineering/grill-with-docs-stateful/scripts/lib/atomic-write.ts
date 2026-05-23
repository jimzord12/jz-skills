import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const directoryPath = dirname(filePath);
  const temporaryPath = join(
    directoryPath,
    `.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );

  await mkdir(directoryPath, { recursive: true });
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, filePath);
}