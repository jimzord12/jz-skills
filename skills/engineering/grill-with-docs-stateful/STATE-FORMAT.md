# State File Format

The state file is the authoritative continuation record for one conceptual grilling session.

## Required section order

1. `# <Session Title>`
2. `## Resume Brief`
3. `## Session Metadata`
4. `## User Preferences`
5. `## Resolved Questions`
6. `## Open Questions`
7. `## Next Question`
8. `## Upcoming Questions`
9. `## Artifact Updates`

Optional sections may appear after the required core sections.

## Required metadata keys

- `Format version`
- `Status`
- `Created at`
- `Updated at`
- `Chat sessions touched`

Recommended metadata keys:

- `Session id`
- `Last loaded at`
- `Last writer`

Valid `Status` values: `active`, `paused`, `completed`, `abandoned`

## Question rules

- Use stable sequential ids like `Q-001`.
- Keep ids stable across rewrites, saves, and compaction.
- The `Next Question` section should name one canonical question.
- The `Upcoming Questions` section should stay short.
- Compacted summaries must still preserve original question ids.

## Template

```md
# Stateful grilling session title

## Resume Brief

2-6 lines summarising what was decided, what is still open, and where to restart.

## Session Metadata

- Format version: 1
- Status: active
- Session id: 001-stateful-grilling-session
- Created at: 2026-05-19T09:00:00.000Z
- Updated at: 2026-05-19T09:30:00.000Z
- Last loaded at: 2026-05-19T09:20:00.000Z
- Chat sessions touched: 1

## User Preferences

### Communication

- Use simple language.
- Explain trade-offs.
- Prefer concrete examples.

### Process

- Ask one question at a time.
- Keep recommended answers explicit.

## Resolved Questions

### Q-001: Should this be a separate skill?

- Decision: Yes. Keep it as a full fork.
- Reasoning: It changes continuation behavior and durable state handling.
- Rejected alternatives: Wrapping `grill-with-docs` would hide too much behavior.

## Open Questions

### Q-002: How should concurrent writes be handled?

- Status: open
- Notes: Prefer merge-first recovery over blind overwrite.

## Next Question

- Q-002: What exact merge workflow should happen after a stale-write conflict?

## Upcoming Questions

- Q-003: When should auto-refresh trigger?
- Q-004: What repair prompts need confirmation?

## Artifact Updates

- [SPEC.md](./SPEC.md): Defined the v1 scope and testing contract.
```
