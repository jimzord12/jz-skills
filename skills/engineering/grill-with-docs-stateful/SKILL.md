---
name: grill-with-docs-stateful
description: Stateful fork of grill-with-docs for long document-aware design sessions. It challenges plans against CONTEXT.md and ADRs while saving, loading, resuming, repairing, and compacting structured session state in .scratch/grilling-sessions/. Use when a grilling session may span multiple chats or the user asks to save, load, resume, or recover a grilling session.
metadata:
  original_skill:
    {
      name: grill-with-docs,
      author: Matt Pococks,
      local_path: .agents/skills/grill-with-docs,
      repo_url: https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs,
    }
  version: 1.0.0
  created_at: May 22, 2026
  updated_at: May 22, 2026 19:50 UTC
---

# Grill With Docs Stateful

Run a normal grilling session, but keep a durable Markdown state artifact when the session needs to survive chat resets.

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Offer recommendations as enumerated options for UX, and clearly mark which option you recommend.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

Before the first save, behave exactly like `grill-with-docs`.

When the user clearly asks to save, load, resume, recover, or compact a stateful grilling session, keep the normal grilling behavior intact and apply the matching state workflow from [REFERENCE.md](./REFERENCE.md).

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

## Stateful behavior

Before the first save, behave like `grill-with-docs`.

Map each clear state-management request to exactly one action from [REFERENCE.md](./REFERENCE.md):

1. Save request: run the save workflow and write or update the current session state.
2. Load request: run the load workflow and present or load a resumable session.
3. Resume request: treat it as a load-for-continuation request and continue the loaded session.
4. Recover request: run the repair workflow for the existing state file.
5. If the request is ambiguous, mixed, or unrecognized, ask which action the user wants before reading or writing any state file.

- Store one authoritative Markdown state artifact per conceptual grilling session in `.scratch/grilling-sessions/`.
- Use the filename pattern `XXX-brief-session-name-state.md`. The numeric prefix identifies the session, not the save count.
- Treat the Markdown state file as canonical. `last-session.json` is only a convenience pointer.
- Preserve the existing status on save unless the user explicitly changes it.
- When a paused session is loaded for real continuation, transition it to `active` and rewrite the state file immediately.
- Allow loading completed or abandoned sessions only through an explicit reopen decision.
- Once a state file exists, quietly auto-refresh it after a small batch of meaningful progress.
- Suggest compaction when the `Resolved Questions` section contains more than 6 resolved questions and at least 1 older resolved question would be moved into a summary block. Do not compact without confirmation.

## Deterministic helpers

Use the local scripts when bookkeeping needs to be reliable or machine-checked:

- `bun .agents/skills/grill-with-docs-stateful/scripts/validate-state.ts --file <path>`
- `bun .agents/skills/grill-with-docs-stateful/scripts/manage-pointer.ts read --pointer <path>`
- `bun .agents/skills/grill-with-docs-stateful/scripts/manage-pointer.ts update --pointer <path> --state <path>`
- `bun .agents/skills/grill-with-docs-stateful/scripts/detect-stale-write.ts --file <path> --expected-hash <hash>`
- `bun .agents/skills/grill-with-docs-stateful/scripts/repair-state.ts --file <path>`
- `bun .agents/skills/grill-with-docs-stateful/scripts/compact-state.ts --file <path> --resolved-limit 6`

## Resources

- State workflow and conflict rules: [REFERENCE.md](./REFERENCE.md)
- State file contract: [STATE-FORMAT.md](./STATE-FORMAT.md)
- Save/load/recovery examples: [EXAMPLES.md](./EXAMPLES.md)
- Full implementation source of truth: [SPEC.md](./SPEC.md)

</supporting-info>

