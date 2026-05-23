#!/usr/bin/env bun
import { exit } from 'node:process';

import { errorMessage, hasFlag, printJson, requireOption } from './cli.ts';
import { atomicWriteFile } from './lib/atomic-write.ts';
import { loadParsedState, repairParsedState, validateParsedState } from './lib/state-file.ts';
import { asStateFilePath } from './lib/types.ts';

const filePath = asStateFilePath(requireOption('--file'));
const shouldWrite = hasFlag('--write');

try {
  const parsedState = await loadParsedState(filePath);
  const repair = repairParsedState(parsedState);
  const validation = validateParsedState(repair.repaired);

  if (shouldWrite) {
    await atomicWriteFile(filePath, repair.repairedMarkdown);
  }

  printJson({
    ok: validation.ok,
    filePath,
    wrote: shouldWrite,
    needsConfirmation: repair.needsConfirmation,
    changes: repair.changes,
    ambiguities: repair.ambiguities,
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