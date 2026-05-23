#!/usr/bin/env bun
import { exit } from 'node:process';

import { errorMessage, hasFlag, parsePositiveIntegerOption, printJson, requireOption } from './cli.ts';
import { atomicWriteFile } from './lib/atomic-write.ts';
import { compactParsedState, loadParsedState, validateParsedState } from './lib/state-file.ts';
import { asStateFilePath } from './lib/types.ts';

const filePath = asStateFilePath(requireOption('--file'));
const shouldWrite = hasFlag('--write');
const resolvedLimit = parsePositiveIntegerOption('--resolved-limit', 6);

try {
  const parsedState = await loadParsedState(filePath);
  const compacted = compactParsedState(parsedState, resolvedLimit);

  if (shouldWrite && compacted.changed) {
    await atomicWriteFile(filePath, compacted.compactedMarkdown);
  }

  const validation = validateParsedState(compacted.parsedState);

  printJson({
    ok: validation.ok,
    filePath,
    wrote: shouldWrite && compacted.changed,
    changed: compacted.changed,
    compactedIds: compacted.compactedIds,
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