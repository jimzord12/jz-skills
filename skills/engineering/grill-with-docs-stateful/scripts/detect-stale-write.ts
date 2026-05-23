#!/usr/bin/env bun
import { exit } from 'node:process';

import { errorMessage, parseExpectedHash, printJson, requireOption } from './cli.ts';
import { loadParsedState } from './lib/state-file.ts';
import { asStateFilePath } from './lib/types.ts';

const filePath = asStateFilePath(requireOption('--file'));
const expectedHash = parseExpectedHash();

try {
  const parsedState = await loadParsedState(filePath);
  const stale = parsedState.contentHash !== expectedHash;

  printJson({ ok: true, filePath, stale, expectedHash, currentHash: parsedState.contentHash });

  if (stale) {
    exit(2);
  }
} catch (error: unknown) {
  printJson({ ok: false, filePath, error: errorMessage(error) });
  exit(1);
}
