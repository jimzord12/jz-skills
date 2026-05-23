import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { clearPointerFile, readPointerFile, updatePointerFromState } from './lib/pointer-file.ts';
import {
  compactParsedState,
  hashContent,
  loadParsedState,
  parseStateMarkdown,
  repairParsedState,
  serializeStateMarkdown,
  validateParsedState,
} from './lib/state-file.ts';
import { asPointerFilePath, asStateFilePath, asQuestionId } from './lib/types.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directoryPath => rm(directoryPath, { recursive: true, force: true }))
  );
});

function buildSampleState(): string {
  return `# Stateful grilling session

## Resume Brief

We resolved the high-level direction and still need the conflict workflow.

## Session Metadata

- Format version: 1
- Status: paused
- Created at: 2026-05-19T09:00:00.000Z
- Updated at: 2026-05-19T09:15:00.000Z
- Chat sessions touched: 1

## User Preferences

### Communication

- Use simple language.
- Explain trade-offs.

## Resolved Questions

### Q-001: Should this be a separate skill?

- Decision: Yes.
- Reasoning: Stateful continuation is a distinct behavior.

### Q-002: Where should state files live?

- Decision: .scratch/grilling-sessions/.
- Reasoning: Hidden tool-owned state should stay out of the main project view.

### Q-003: Should the filename stay stable?

- Decision: Yes.
- Reasoning: Stable references matter more than topic drift.

## Open Questions

### Q-004: How should conflicts be handled?

- Status: open
- Notes: Prefer merge-first recovery.

## Next Question

- Q-004: What exact merge flow should run after a stale-write conflict?

## Upcoming Questions

- Q-005: When should auto-refresh trigger?
- Q-006: What repairs need confirmation?

## Artifact Updates

- SPEC.md: Defined the v1 contract.
`;
}

describe('state helper tools', () => {
  test('validates a well-formed state file', () => {
    const parsedState = parseStateMarkdown(buildSampleState());
    const validation = validateParsedState(parsedState);

    expect(validation.ok).toBe(true);
    expect(parsedState.metadata.Status).toBe('paused');
    expect(parsedState.nextQuestions).toHaveLength(1);
  });

  test('repair rebuilds missing sections and metadata', () => {
    const parsedState = parseStateMarkdown(
      `# Broken state

## Open Questions

### Q-004: Missing almost everything

- Status: open
`
    );
    const repair = repairParsedState(parsedState, '2026-05-19T10:00:00.000Z');
    const repairedParsedState = parseStateMarkdown(repair.repairedMarkdown);
    const validation = validateParsedState(repairedParsedState);

    expect(repair.changes.length).toBeGreaterThan(0);
    expect(validation.ok).toBe(true);
    expect(repairedParsedState.metadata.Status).toBe('paused');
    expect(repairedParsedState.nextQuestions).toHaveLength(1);
  });

  test('salvages question headings without the expected colon separator', () => {
    const parsedState = parseStateMarkdown(
      `# Drifted state

## Resume Brief

Resume this session.

## Session Metadata

- Format version: 1
- Status: paused
- Created at: 2026-05-19T09:00:00.000Z
- Updated at: 2026-05-19T09:15:00.000Z
- Chat sessions touched: 1

## User Preferences

### Communication

- Use simple language.

## Resolved Questions

### Compacted Summary

- None recorded yet.

## Open Questions

Intro line that should stay preserved.

### Q-004 How should conflicts be handled?

- Status: open
- Notes: Prefer merge-first recovery.

## Next Question

- Q-004 What exact merge flow should run after a stale-write conflict?

## Upcoming Questions

- Q-005 When should auto-refresh trigger?

## Artifact Updates

- SPEC.md: Defined the v1 contract.
`
    );

    expect(parsedState.openQuestions).toHaveLength(1);
    expect(parsedState.openQuestions[0]?.id).toBe(asQuestionId('Q-004'));
    expect(parsedState.openQuestions[0]?.title).toBe('How should conflicts be handled?');
    expect(parsedState.openOtherBlocks[0]?.lines).toContain(
      'Intro line that should stay preserved.'
    );
  });

  test('salvages next and upcoming question bullets without the expected colon separator', () => {
    const parsedState = parseStateMarkdown(
      `# Drifted state

## Resume Brief

Resume this session.

## Session Metadata

- Format version: 1
- Status: paused
- Created at: 2026-05-19T09:00:00.000Z
- Updated at: 2026-05-19T09:15:00.000Z
- Chat sessions touched: 1

## User Preferences

### Communication

- Use simple language.

## Resolved Questions

### Compacted Summary

- None recorded yet.

## Open Questions

### Q-004: How should conflicts be handled?

- Status: open
- Notes: Prefer merge-first recovery.

### Q-005: When should auto-refresh trigger?

- Status: open

## Next Question

- Q-004 What exact merge flow should run after a stale-write conflict?

## Upcoming Questions

- Q-005 When should auto-refresh trigger?

## Artifact Updates

- SPEC.md: Defined the v1 contract.
`
    );

    expect(parsedState.nextQuestions).toEqual([
      {
        id: asQuestionId('Q-004'),
        text: 'What exact merge flow should run after a stale-write conflict?',
      },
    ]);
    expect(parsedState.upcomingQuestions).toEqual([
      { id: asQuestionId('Q-005'), text: 'When should auto-refresh trigger?' },
    ]);
  });

  test('salvages required section headings with extra surrounding whitespace', () => {
    const parsedState = parseStateMarkdown(
      `# Drifted state

##   Resume Brief

Resume this session.

##   Session Metadata

- Format version: 1
- Status: paused
- Created at: 2026-05-19T09:00:00.000Z
- Updated at: 2026-05-19T09:15:00.000Z
- Chat sessions touched: 1

## User Preferences

### Communication

- Use simple language.

## Resolved Questions

### Compacted Summary

- None recorded yet.

##   Open Questions

### Q-004: How should conflicts be handled?

- Status: open

## Next Question

- Q-004: What exact merge flow should run after a stale-write conflict?

##   Upcoming Questions

- Q-005: When should auto-refresh trigger?

## Artifact Updates

- SPEC.md: Defined the v1 contract.
`
    );

    const validation = validateParsedState(parsedState);

    expect(validation.ok).toBe(true);
    expect(parsedState.sectionMap.has('Open Questions')).toBe(true);
    expect(parsedState.nextQuestions).toHaveLength(1);
  });

  test('repair flags duplicate required sections as ambiguous before normalizing them', () => {
    const parsedState = parseStateMarkdown(
      `# Drifted state

## Resume Brief

Resume this session.

## Session Metadata

- Format version: 1
- Status: paused
- Created at: 2026-05-19T09:00:00.000Z
- Updated at: 2026-05-19T09:15:00.000Z
- Chat sessions touched: 1

## User Preferences

### Communication

- Use simple language.

## Resolved Questions

### Compacted Summary

- None recorded yet.

## Open Questions

### Q-004: How should conflicts be handled?

- Status: open

## Next Question

- Q-004: What exact merge flow should run after a stale-write conflict?

## Next Question

- Q-005: A conflicting next question from another edit.

## Upcoming Questions

- Q-005: When should auto-refresh trigger?

## Artifact Updates

- SPEC.md: Defined the v1 contract.
`
    );

    const repair = repairParsedState(parsedState, '2026-05-19T10:00:00.000Z');
    const repairedParsedState = parseStateMarkdown(repair.repairedMarkdown);

    expect(repair.needsConfirmation).toBe(true);
    expect(repair.ambiguities).toContain('Found duplicate required sections: Next Question.');
    expect(repairedParsedState.nextQuestions).toHaveLength(1);
    expect(repairedParsedState.nextQuestions[0]?.id).toBe(asQuestionId('Q-005'));
  });

  test('compaction preserves question ids in a compact summary block', () => {
    const parsedState = parseStateMarkdown(buildSampleState());
    const compacted = compactParsedState(parsedState, 1);
    const compactedParsedState = parseStateMarkdown(compacted.compactedMarkdown);

    expect(compacted.changed).toBe(true);
    expect(compacted.compactedIds).toEqual([asQuestionId('Q-001'), asQuestionId('Q-002')]);
    expect(
      compactedParsedState.resolvedOtherBlocks.some(
        block =>
          block.title === 'Compacted Summary' && block.lines.some(line => line.includes('Q-001'))
      )
    ).toBe(true);
    expect(compactedParsedState.resolvedQuestions).toHaveLength(1);
  });

  test('pointer file updates for resumable states and clears for completed ones', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'grill-stateful-'));
    temporaryDirectories.push(directoryPath);

    const statePath = asStateFilePath(join(directoryPath, '001-stateful-session-state.md'));
    const pointerPath = asPointerFilePath(join(directoryPath, 'last-session.json'));

    await writeFile(statePath, buildSampleState(), 'utf8');

    const updated = await updatePointerFromState(pointerPath, statePath);
    const readBack = await readPointerFile(pointerPath);

    expect(updated.pointer.path).toBe(statePath);
    expect(readBack.pointer.status).toBe('paused');

    const completedState = parseStateMarkdown(buildSampleState());
    completedState.metadata.Status = 'completed';
    await writeFile(statePath, serializeStateMarkdown(completedState), 'utf8');

    await updatePointerFromState(pointerPath, statePath);
    const cleared = await readPointerFile(pointerPath);

    expect(cleared.pointer.path).toBeNull();
    expect(cleared.pointer.status).toBeNull();

    await clearPointerFile(pointerPath);
    const explicitlyCleared = JSON.parse(await readFile(pointerPath, 'utf8')) as {
      description: string | null;
    };
    expect(explicitlyCleared.description).toBeNull();
  });

  test('hashes detect stale writes', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'grill-stateful-hash-'));
    temporaryDirectories.push(directoryPath);

    const statePath = asStateFilePath(join(directoryPath, '001-stateful-session-state.md'));
    await writeFile(statePath, buildSampleState(), 'utf8');

    const parsedState = await loadParsedState(statePath);
    const originalHash = parsedState.contentHash;

    await writeFile(statePath, `${buildSampleState()}\nExtra line\n`, 'utf8');

    const changedHash = hashContent(await readFile(statePath, 'utf8'));
    expect(changedHash).not.toBe(originalHash);
  });
});
