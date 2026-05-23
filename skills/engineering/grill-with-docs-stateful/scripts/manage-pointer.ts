#!/usr/bin/env bun
import { exit } from 'node:process';

import { errorMessage, printJson, readCommand, requireOption } from './cli.ts';
import { clearPointerFile, readPointerFile, updatePointerFromState } from './lib/pointer-file.ts';
import { asPointerFilePath, asStateFilePath } from './lib/types.ts';

type ManagePointerCommand = 'read' | 'update' | 'clear';
type ManagePointerResult =
  | Awaited<ReturnType<typeof readPointerFile>>
  | Awaited<ReturnType<typeof updatePointerFromState>>
  | { ok: true; pointer: Awaited<ReturnType<typeof clearPointerFile>> };

function isManagePointerCommand(value: string | null): value is ManagePointerCommand {
  return value === 'read' || value === 'update' || value === 'clear';
}

const command = readCommand();
const pointerPath = asPointerFilePath(requireOption('--pointer'));

if (!isManagePointerCommand(command)) {
  printJson({
    ok: false,
    error: 'Usage: manage-pointer.ts <read|update|clear> --pointer <path> [--state <path>]',
  });
  exit(1);
}

try {
  let result: ManagePointerResult;

  switch (command) {
    case 'read':
      result = await readPointerFile(pointerPath);
      break;
    case 'update': {
      const statePath = asStateFilePath(requireOption('--state'));
      result = await updatePointerFromState(pointerPath, statePath);
      break;
    }
    case 'clear':
      result = { ok: true, pointer: await clearPointerFile(pointerPath) };
      break;
  }

  printJson({ ok: true, command, ...result });
} catch (error: unknown) {
  printJson({ ok: false, command, error: errorMessage(error) });
  exit(1);
}
