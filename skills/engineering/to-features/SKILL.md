---
name: to-features
description: Derives a feature backlog from CONTEXT.md and nearby domain artifacts, then writes stable feature artifacts under docs/features. Use when the user wants to turn a domain model, completed grilling session, ADR set, or existing codebase context into an ordered feature list, decide which features deserve grilling first, or identify which ones can go straight to issues, TDD or implementation.
---

# To Features

Derive a stable feature backlog from the domain root before writing PRDs or issues.

## Quick start

1. Treat `CONTEXT.md` as the stable root.
2. Read nearby domain artifacts only to refine or confirm feature boundaries.
3. Derive capabilities, not nouns, modules, or implementation tasks.
4. Write the backlog and feature artifacts under `docs/features/`.

## Workflows

### 1. Build from the stable root

- Start from `CONTEXT.md`.
- Also use `docs/adr/`, `docs/domain-cheatsheet.md`, the current codebase shape, and completed grilling-session artifacts when they clarify scope.
- Prefer the glossary vocabulary exactly as written.
- If sources disagree, treat `CONTEXT.md` as canonical unless the user says otherwise.

### 2. Derive features

- Extract user-valuable capabilities from actors, lifecycle transitions, and durable rules.
- Convert domain concepts into feature statements such as “Accept `/run` and persist the initial Run Record”.
- Reject horizontal slices like “build repository layer” or “add Run Record type”.
- Merge duplicates that describe the same capability from different angles.

### 3. Classify before expanding

For each feature, decide whether it is:

- `core-path`
- `high-risk`
- `supporting`

Also choose the next step:

- `grill-first`
- `direct-to-prd`
- `direct-to-issues`
- `direct-to-tdd`

### 4. Write stable artifacts

- Create `docs/features/` lazily if it does not exist.
- Write an ordered backlog index.
- Write one directory per feature using the `XXX-feature-name` convention.
- Keep one canonical feature file per directory.

See [REFERENCE.md](REFERENCE.md) for extraction rules and the output contract.

### 5. Review with the user

Present the proposed backlog as a numbered list and ask only the minimum needed:

- Are the feature boundaries right?
- Is the ordering right?
- Which features deserve grilling first?
- Which features are already clear enough to skip straight to PRD, issues, or TDD?

## Guardrails

- Prefer a stable root and a simpler mental model over exhaustive discovery.
- Do not turn glossary terms directly into backlog items without a user-valuable capability.
- Do not generate implementation tasks or issue slices here; that belongs to `/to-issues`.
- Do not force a PRD for every feature.
- Keep the backlog small, explicit, and reorderable.

