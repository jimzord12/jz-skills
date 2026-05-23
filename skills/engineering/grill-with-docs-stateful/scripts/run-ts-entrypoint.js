#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function runTsEntrypoint(targetFile, forwardedArgs = process.argv.slice(2)) {
  const wrapperDirectory = fileURLToPath(new URL('.', import.meta.url));
  const targetPath = fileURLToPath(new URL(targetFile, import.meta.url));
  const child = spawn('bun', [targetPath, ...forwardedArgs], {
    cwd: wrapperDirectory,
    stdio: 'inherit',
  });

  child.on('error', error => {
    if ('code' in error && error.code === 'ENOENT') {
      console.error(
        JSON.stringify({
          ok: false,
          error: 'bun is required to run this wrapper but was not found on PATH.',
          targetFile,
        })
      );
      process.exit(1);
    }

    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        targetFile,
      })
    );
    process.exit(1);
  });

  child.on('exit', code => {
    process.exit(code ?? 1);
  });
}
