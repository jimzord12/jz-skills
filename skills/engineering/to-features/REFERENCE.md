# To Features Reference

Use this file when the backlog needs more structure than fits comfortably in `SKILL.md`.

## Purpose

`/to-features` sits between domain modeling and execution planning.

- `CONTEXT.md` defines the stable language and durable rules.
- `/to-features` derives a capability backlog from that root.
- Grilling sharpens only the features with real ambiguity or risk.
- `/to-prd` specifies a larger feature when needed.
- `/to-issues` turns an understood feature or PRD into tracer-bullet execution slices.
- `/tdd` builds one chosen slice at a time.

## What counts as a feature

A feature is a user-valuable capability that the system must provide.

Good feature examples:

- Accept `/run` and persist the initial Run Record
- Reject invalid `/run` requests before creating a Feature Run
- Supervise a live Feature Worker and record lifecycle events
- Reconcile active runs after Orchestrator restart
- Publish terminal run summaries for humans

Bad feature examples:

- Add Run Record repository
- Build Telegram adapter
- Create event enum
- Implement persistence layer

Those are implementation tasks or modules, not features.

## Stable extraction rules

Derive features from these sources, in this order:

1. Actors and operator-visible goals
2. Lifecycle transitions and terminal outcomes
3. Durable invariants that force behavior boundaries
4. Existing codebase seams that suggest a natural thin slice

Use these questions to extract capabilities:

1. What valuable thing can an actor now do?
2. What complete path through the system would demonstrate that value?
3. Which domain concepts must participate for that capability to exist?
4. Is this really one capability, or is it two features currently glued together?

## Classification rules

Each feature should get both a type and a recommended next step.

### Feature types

- `core-path`: needed for the main product loop to work
- `high-risk`: likely to cause churn unless clarified first
- `supporting`: useful, but not the primary thin path through the product

### Recommended next step

- `grill-first`: use when the feature boundary, invariants, or failure model are still fuzzy
- `direct-to-prd`: use when the feature spans multiple modules or needs explicit interface decisions
- `direct-to-issues`: use when the feature is already clear enough to slice into tracer bullets
- `direct-to-tdd`: use only for small, clear features that can be built as one thin public-behavior slice

## Output contract

Write artifacts under `docs/features/`.

Recommended layout:

```text
docs/features/
├── README.md
├── 001-run-acceptance/
│   └── feature.md
├── 002-worker-supervision/
│   └── feature.md
└── 003-recovery-reconciliation/
    └── feature.md
```

### `docs/features/README.md`

Use this as the ordered backlog index.

Suggested structure:

```md
# Feature Backlog

## Ordering Principles

- Stable root: `CONTEXT.md`
- Prefer thin end-to-end value slices
- Grill only risky or ambiguous features

## Features

1. `001-run-acceptance` — core-path — next: `direct-to-issues`
2. `002-worker-supervision` — high-risk — next: `grill-first`
3. `003-recovery-reconciliation` — high-risk — next: `grill-first`
```

### `docs/features/XXX-feature-name/feature.md`

Use this structure:

```md
# Feature Title

## Why it exists

Short user-valuable capability statement.

## Type

`core-path` | `high-risk` | `supporting`

## Recommended next step

`grill-first` | `direct-to-prd` | `direct-to-issues` | `direct-to-tdd`

## Domain concepts touched

- Concept A
- Concept B

## Core path

1. Step one
2. Step two
3. Step three

## Valuable edge cases

- Edge case worth grilling
- Edge case worth deferring

## Notes

Only durable, high-signal notes. Do not turn this into a PRD.
```

## Review checklist

- Does each item describe a capability instead of an implementation component?
- Could each feature be demonstrated or verified on its own?
- Is ordering based on product value and dependency reality?
- Are only the risky features marked `grill-first`?
- Are simple, clear features allowed to skip PRD?
