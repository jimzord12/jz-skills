import { readFile } from 'node:fs/promises';

import { POINTER_EMPTY_RECORD, isResumableWorkflowStatus, isWorkflowStatus } from './constants.ts';
import { atomicWriteFile } from './atomic-write.ts';
import { loadParsedState } from './state-file.ts';
import {
  asStateFilePath,
  type ParsedState,
  type PointerFilePath,
  type PointerReadResult,
  type PointerRecord,
  type StateFilePath,
  type UpdatePointerResult,
} from './types.ts';

function emptyPointerRecord(): PointerRecord {
  return { ...POINTER_EMPTY_RECORD };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPointerRecordValue(
  value: unknown
): value is { path: string | null; status: string | null; description: string | null } {
  if (!isRecord(value)) {
    return false;
  }

  return (
    'path' in value &&
    (typeof value.path === 'string' || value.path === null) &&
    'status' in value &&
    (typeof value.status === 'string' || value.status === null) &&
    'description' in value &&
    (typeof value.description === 'string' || value.description === null)
  );
}

function toPointerRecord(value: {
  path: string | null;
  status: 'active' | 'paused' | null;
  description: string | null;
}): PointerRecord {
  return {
    path: value.path === null ? null : asStateFilePath(value.path),
    status: value.status === null ? null : value.status,
    description: value.description,
  };
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function readPointerFile(
  pointerPath: PointerFilePath | string
): Promise<PointerReadResult> {
  try {
    const raw = await readFile(pointerPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isPointerRecordValue(parsed)) {
      return {
        ok: false,
        pointer: emptyPointerRecord(),
        error: 'Pointer file is missing required keys.',
      };
    }

    const normalizedStatus = parsed.status;

    if (normalizedStatus !== null && !isWorkflowStatus(normalizedStatus)) {
      return {
        ok: false,
        pointer: emptyPointerRecord(),
        error: `Pointer file has invalid status ${normalizedStatus}.`,
      };
    }

    if (normalizedStatus !== null && !isResumableWorkflowStatus(normalizedStatus)) {
      return {
        ok: false,
        pointer: emptyPointerRecord(),
        error: `Pointer file has non-resumable status ${normalizedStatus}.`,
      };
    }

    return {
      ok: true,
      pointer: toPointerRecord({ ...parsed, status: normalizedStatus }),
      error: null,
    };
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return { ok: true, pointer: emptyPointerRecord(), error: null };
    }

    return {
      ok: false,
      pointer: emptyPointerRecord(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildPointerRecordFromState(
  parsedState: ParsedState,
  statePath: StateFilePath
): PointerRecord {
  const status = parsedState.metadata.Status;

  if (!status || !isWorkflowStatus(status) || !isResumableWorkflowStatus(status)) {
    return emptyPointerRecord();
  }

  const resumeBrief = parsedState.sectionMap
    .get('Resume Brief')
    ?.body.find(line => line.trim().length > 0);

  const description = [parsedState.title, resumeBrief]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' - ')
    .slice(0, 200);

  return { path: statePath, status, description: description.length > 0 ? description : null };
}

export async function writePointerFile(
  pointerPath: PointerFilePath | string,
  pointerRecord: PointerRecord
): Promise<PointerRecord> {
  await atomicWriteFile(pointerPath, `${JSON.stringify(pointerRecord, null, 2)}\n`);
  return pointerRecord;
}

export async function updatePointerFromState(
  pointerPath: PointerFilePath | string,
  statePath: StateFilePath | string
): Promise<UpdatePointerResult> {
  const normalizedStatePath =
    typeof statePath === 'string' ? asStateFilePath(statePath) : statePath;
  const parsedState = await loadParsedState(normalizedStatePath);
  const pointerRecord = buildPointerRecordFromState(parsedState, normalizedStatePath);
  await writePointerFile(pointerPath, pointerRecord);

  const stateStatus = parsedState.metadata.Status;
  return {
    pointer: pointerRecord,
    stateStatus: stateStatus && isWorkflowStatus(stateStatus) ? stateStatus : null,
  };
}

export async function clearPointerFile(
  pointerPath: PointerFilePath | string
): Promise<PointerRecord> {
  const pointerRecord = emptyPointerRecord();
  await writePointerFile(pointerPath, pointerRecord);
  return pointerRecord;
}
