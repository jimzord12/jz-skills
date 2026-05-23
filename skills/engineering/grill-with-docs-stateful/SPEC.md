# grill-with-docs-stateful

## Problem Statement

The current `grill-with-docs` workflow works well for deep design sessions, but it breaks down when one conceptual grilling session spans multiple AI chats. Long sessions regularly reach context-window limits, force manual session switching, and push the user to rely on `/handoff` as a workaround. That creates friction, repeats context, and increases the risk of losing important decisions, rejected alternatives, or the exact next question that should be asked.

From the user's perspective, the problem is not that grilling quality is poor. The problem is that the continuation experience is weak. A user can spend hours refining one design, debating tradeoffs, tightening vocabulary, and updating docs, then still need to manually reconstruct the session in a fresh chat. The missing capability is durable, structured session state that allows the grilling workflow to resume from the exact right point without depending on `/handoff`.

## Solution

Create a separate personal skill named `grill-with-docs-stateful` as a full fork of `grill-with-docs`. It remains document-aware and continues to challenge terminology against the project's glossary and ADRs, but it adds first-class save, load, resume, and recovery behavior for long-running grilling sessions.

The skill stores one structured Markdown state artifact per conceptual grilling session. That artifact becomes the authoritative continuation record. It captures the session's resume brief, metadata, user preferences, resolved questions, open questions, next question, upcoming questions, and artifact updates. The skill also maintains a tiny `last-session.json` helper file that points to the most recently resumable session.

The user can start a normal grilling session, explicitly save state when they decide persistence is needed, and later load that state in a fresh chat. Once a state file exists, the skill can auto-refresh it after meaningful progress so important reasoning is not lost between explicit saves. The end result is a grilling experience that can span many chats and still feel like one continuous conversation, without normal dependence on `/handoff`.

## User Stories

1. As a developer using `grill-with-docs`, I want a stateful version of the skill, so that long design sessions can continue across multiple chats.
2. As a developer running a long grilling session, I want to save the current session state, so that I do not lose progress when the chat gets too large.
3. As a developer returning later, I want to load a saved grilling session, so that I can resume from the exact right point.
4. As a developer who debates and revises answers heavily, I want resolved questions to keep their reasoning and relevant rejected alternatives, so that later sessions do not reopen settled branches by accident.
5. As a developer who cares about wording, I want important exact quotes preserved when wording materially matters, so that compressed summaries do not lose nuance.
6. As a developer, I want one state file per conceptual grilling session, so that the session remains coherent over time.
7. As a developer, I want repeated saves to update the same state file, so that one session does not fragment into many competing snapshots.
8. As a developer, I want a clear `Resume Brief` at the top of the state file, so that I can quickly re-enter the discussion without reading every section.
9. As a developer, I want visible session metadata in the state file, so that I can see status, timestamps, version, and other operational details at a glance.
10. As a developer, I want the state file to record my communication preferences, so that resumed sessions keep using simple language, reasoning explanations, and concrete examples.
11. As a developer, I want the skill to record open questions and the next question to ask, so that resumed sessions continue with momentum instead of re-triaging the whole conversation.
12. As a developer, I want a short upcoming-question list in addition to the single next question, so that the session still has direction if the top question becomes irrelevant.
13. As a developer, I want stable question IDs, so that questions remain traceable even after rewrites, compaction, or movement between sections.
14. As a developer, I want compaction to preserve old question IDs inside summary blocks, so that continuity is not lost when older branches are compressed.
15. As a developer, I want the skill to record which durable artifacts changed during the grilling session, so that the next session can see what already became project truth.
16. As a developer, I want the state file to stay human-readable Markdown, so that I can inspect or edit it manually when needed.
17. As a developer, I want manual edits to remain a supported workflow, so that I can adjust status or wording without breaking the system.
18. As a developer, I want malformed state files to be repairable, so that one editing mistake does not destroy the workflow.
19. As a developer, I want save-state to preserve the current status unless I explicitly change it, so that saving does not silently reinterpret the session.
20. As a developer, I want paused sessions to become active when I load them for real continuation, so that the status reflects reality.
21. As a developer, I want active sessions to remain valid even if more than one chat touches them, so that concurrency does not distort the status model.
22. As a developer, I want conflicts between concurrent sessions to be detected before write, so that one session does not silently overwrite another.
23. As a developer, I want merge-first recovery when conflicts happen, so that two sessions can preserve progress in one authoritative artifact whenever possible.
24. As a developer, I want the skill to auto-refresh state after meaningful progress once a state file exists, so that important reasoning is not lost between explicit saves.
25. As a developer, I want auto-refresh to stay quiet unless something important changes, so that the conversation does not fill with bookkeeping noise.
26. As a developer, I want the helper pointer file to identify the last resumable session, so that the skill can confidently suggest the right continuation target.
27. As a developer, I want the pointer file cleared when a session is completed or abandoned, so that the system does not default to a session that is no longer resumable.
28. As a developer, I want the pointer file description to be generated automatically, so that low-value metadata does not add manual work.
29. As a developer, I want the skill to suggest loading a likely session when the conversation looks like a continuation, so that I do not have to remember the command every time.
30. As a developer, I want the skill to accept natural-language save/load phrasing in addition to canonical subcommands, so that the workflow feels natural.
31. As a developer, I want the filename to remain stable after creation, so that references do not churn when the topic focus evolves.
32. As a developer, I want helper scripts to validate state structure deterministically, so that save/load behavior is more reliable than prompt-only parsing.
33. As a developer, I want helper script writes to be atomic, so that crashes or interrupted writes do not corrupt the state.
34. As a developer, I want stale completed or abandoned sessions to be surfaced for review, so that the working folder stays manageable over time without auto-deleting valuable artifacts.
35. As a developer, I want the first version of the skill to replace my real `/handoff` workflow across multiple save/load cycles, so that the feature solves the actual problem I have.

## Implementation Decisions

- Build a new separate personal skill named `grill-with-docs-stateful` rather than modifying `grill-with-docs` in place.
- Keep the new skill explicitly document-aware. It should continue to read and challenge glossary language, cross-check documentation, and update durable docs when appropriate.
- Treat this new skill as a full fork of `grill-with-docs`, not as a wrapper and not as a generic grilling skill.
- Create one authoritative Markdown state artifact per conceptual grilling session.
- Store state artifacts under `.scratch/grilling-sessions/` by default, but do not enforce repository policy about whether those files are ignored or committed.
- Use the filename pattern `XXX-{brief-session-name}-state.md`, where the numeric prefix identifies the conceptual grilling session rather than the save count.
- Keep the filename stable after creation. If the session topic evolves, update the in-file title, resume brief, and helper description rather than renaming the file.
- Use structured Markdown for the state artifact rather than a freeform summary. The state artifact must remain readable to humans while still being predictable enough for reliable resume.
- Treat the Markdown state artifact as the authoritative source of truth. Helper files may assist with discovery and routing, but they must not outrank the Markdown state.
- Include a `Resume Brief` section inside the state artifact so the skill can replace normal `/handoff` usage for grilling sessions.
- Include a visible `Session Metadata` section in the state artifact rather than YAML frontmatter.
- Include an explicit `Format version` field in the metadata so the state schema can evolve safely.
- Use required core sections in a fixed order, with optional extra sections allowed afterward when needed.
- Required core sections should cover resume orientation, metadata, user preferences, resolved questions, open questions, next question, upcoming questions, and artifact updates.
- Capture user communication preferences in a dedicated section grouped by category rather than burying them inside decision history.
- Treat state statuses as `active`, `paused`, `completed`, and `abandoned`.
- Interpret `active` as meaning the conceptual grilling session is still an active workstream, even if it spans multiple chat refreshes or multiple chats.
- Interpret `paused` as meaning the session is intended to continue later but is not currently being worked on.
- Interpret `completed` as meaning the grilling session reached a meaningful end, while still allowing later reopen into `active` or `paused`.
- Interpret `abandoned` as meaning the session is no longer intended to continue.
- Preserve current status when saving state unless the user explicitly changes it.
- When loading a paused session for real continuation, automatically transition it to `active`.
- Allow completed or abandoned sessions to be loaded, but require explicit reopen behavior rather than silently treating them as active continuation.
- Track how many distinct chat sessions have touched the conceptual grilling session. Increment that count when a new chat loads the session.
- Rewrite the state artifact immediately on load when load-side metadata changes, rather than deferring those updates until a later manual save.
- Create the first state artifact only when the user explicitly saves state for the first time.
- Once a state artifact exists, allow bounded auto-refresh after a small batch of meaningful changes rather than requiring explicit save for every update.
- Treat `save-state` as the explicit checkpoint command even after auto-refresh exists.
- Mention auto-refresh only when it changed something important to the user's mental model, such as session status, next-question direction, compaction, or pointer-file behavior.
- Save-state should write directly when the skill is confident in the summary and structure, but should ask for confirmation when key details are ambiguous.
- Load-state should be suggestion-friendly rather than silently auto-loading just because the topic looks similar.
- Accept canonical subcommands like `save-state` and `load-state`, but also accept clear natural-language variations of those actions.
- Add stable sequential question IDs, such as `Q-001`, to all tracked questions.
- Preserve each resolved question's decision, short reasoning, and any rejected alternatives that still matter later.
- Default to compressed summaries for captured reasoning, but preserve exact wording when wording itself matters to a decision.
- Record durable artifact changes in the state file through references and short notes, not by copying entire artifact bodies into the state file.
- Keep one canonical next question plus a short upcoming-question list, rather than only one question or a heavy queue.
- Allow compaction of older settled branches into summary blocks, while preserving the original question IDs inside those compacted blocks.
- Let the skill suggest compaction when the state artifact grows large, but require confirmation before performing it.
- Support manual edits to the Markdown state file as a normal workflow as long as the required structure remains valid.
- If the state file becomes malformed or loses required sections, attempt reconstruction from existing content and ask for confirmation before writing the repaired version.
- Use a tiny `last-session.json` helper file containing only the last resumable session path, its status, and a short description.
- Treat `last-session.json` as a convenience pointer, not as the authoritative state source.
- Only point `last-session.json` at resumable sessions. If a session becomes completed or abandoned, clear the pointer values.
- If the pointer file and the Markdown state file disagree, trust the Markdown file, clear the pointer when necessary, and ask the user which session to open.
- When there is no trusted pointer, scan the grilling-session folder, find resumable sessions, and present choices rather than forcing filename entry or blindly auto-picking.
- Detect concurrent-write conflicts by checking whether the state artifact changed since the current session last read it.
- On conflict, prefer reloading the latest version and merging the current session's changes into it rather than overwriting or forking by default.
- Provide deterministic helper scripts for validation, pointer management, stale-write detection, and similar bookkeeping work, while leaving semantic reasoning and question selection to the prompt-driven skill behavior.
- Keep helper scripts local to the `grill-with-docs-stateful` skill folder rather than prematurely generalizing them into shared infrastructure.
- Write helper scripts in plain JavaScript with no external dependencies.
- Expose helper scripts through stable CLI-style interfaces with predictable arguments and machine-readable JSON output.
- Use atomic write patterns for both the main state artifact and `last-session.json`.
- Package the skill with a lean `SKILL.md`, companion reference material, examples, and local helper scripts.
- Keep a separate clean implementation source of truth for the skill, rather than relying on the rough draft notes as the implementation contract.
- Treat v1 success as replacing the user's real `/handoff` workflow for long grilling sessions across multiple save/load cycles.
- Use a multi-cycle acceptance scenario ending in a completed session as the first meaningful success check, rather than a one-cycle smoke test or an all-edge-cases stress test.

## Testing Decisions

- Good tests should focus on external behavior and durable contracts, not internal implementation details.
- Good tests should verify what a user or calling skill can rely on: state creation, load behavior, status transitions, pointer-file behavior, conflict detection, repair prompts, and compaction results.
- Good tests should avoid coupling to internal formatting choices that are not part of the public contract.
- Test the state-file validation module because it is a deterministic deep module with a stable interface.
- Test the pointer-file read/update behavior because it is a small but important routing mechanism.
- Test the stale-write conflict detector because silent overwrite is one of the highest-risk failures in the design.
- Test the state repair helper because malformed files should be recoverable without destroying the workflow.
- Test the compaction helper at the contract level, especially preservation of question IDs and retention of materially important wording.
- Test save/load lifecycle behavior through realistic scenarios that reflect the user's long-session workflow rather than only isolated helper units.
- Test that paused sessions become active on resume load and that completed or abandoned sessions require explicit reopen behavior.
- Test that `last-session.json` is cleared when a session becomes non-resumable.
- Test that auto-refresh happens only after meaningful progress thresholds rather than on every tiny change.
- Test that atomic-write behavior never leaves partially written state in the normal supported flows.
- Use existing repository testing style as prior art: the codebase already includes focused tests for configuration loading and file-backed persistence behavior, which is the right precedent for this skill's deterministic helpers.

## Out of Scope

- Replacing or modifying the existing `grill-with-docs` skill in place.
- Building a generic stateful grilling skill for all workflows.
- Keeping `/handoff` as a co-equal long-term continuation mechanism for this skill.
- Migrating old `/handoff` artifacts into the new system.
- Auto-editing repository policy files such as `.gitignore`.
- Automatically deleting stale state artifacts.
- Building a general shared script framework for multiple unrelated skills from day one.
- Turning the state artifact into a verbatim chat transcript.
- Treating the state artifact as canonical project documentation in place of glossary updates, ADRs, or other real durable docs.
- Solving all future skill-version migration needs beyond the presence of an explicit format version and careful evolution room.

## Further Notes

- The clean implementation source of truth for this feature should live inside the `grill-with-docs-stateful` skill folder as `SPEC.md`.
- The existing rough draft should remain available as historical brainstorming material rather than being overwritten.
- Final user-facing skill docs should be derived from this spec rather than written ad hoc.
- The first implementation should be judged primarily by whether it removes normal reliance on `/handoff` for the user's real long-form grilling workflow.
- Publishing this PRD to an issue tracker is currently blocked because this repository does not yet contain configured issue-tracker and triage-label setup for the engineering skills.
