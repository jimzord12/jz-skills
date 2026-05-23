#!/usr/bin/env bun
import { exit } from 'node:process';

import { errorMessage, printJson, requireOption } from './cli.ts';
import { loadParsedState, validateParsedState } from './lib/state-file.ts';
import { asStateFilePath } from './lib/types.ts';

const filePath = asStateFilePath(requireOption('--file'));

try {
  const parsedState = await loadParsedState(filePath);
  const validation = validateParsedState(parsedState);

  printJson({
    ok: validation.ok,
    filePath,
    hash: parsedState.contentHash,
    title: parsedState.title,
    metadata: parsedState.metadata,
    errors: validation.errors,
    warnings: validation.warnings,
  });

  if (!validation.ok) {
    exit(1);
  }
} catch (error: unknown) {
  printJson({ ok: false, filePath, error: errorMessage(error) });
  exit(1);
}