# Stateful Workflow Reference

Use this when the skill needs durable state, conflict recovery, or compaction behavior.

## Start and save

1. Start grilling normally.
2. Do not create a state file until the user explicitly asks to save.
3. On first save:
   - pick the next numeric prefix in `.scratch/grilling-sessions/`
   - create `XXX-brief-session-name-state.md`
   - create or update `.scratch/grilling-sessions/last-session.json`
4. On later saves:
   - update the same state file
   - preserve `Status` unless the user explicitly changes it

## Load and resume

1. Prefer suggestion-friendly loading.
2. If `last-session.json` is valid and points to an `active` or `paused` session, suggest that session first.
3. If the pointer is missing or untrusted, scan `.scratch/grilling-sessions/` and present resumable choices.
4. When loading a paused session for real continuation:
   - change `Status` to `active`
   - increment `Chat sessions touched` if this is a new chat
   - rewrite the state file immediately
5. When loading a completed or abandoned session, ask whether to reopen into `active` or `paused` before treating it as resumable.

## Conflict handling

Before writing an existing state file, compare the last known file hash with the current hash.

1. If the hash matches, write normally.
2. If the hash changed:
   - reload the latest state
   - merge the new session's progress into it
   - validate the merged result
   - only then write back
3. Do not overwrite a conflicting file blindly.

Use `detect-stale-write.ts` for the hash check and `validate-state.ts` after any merge or repair.

## Repair flow

If the state file is malformed or missing required sections:

1. Run `repair-state.ts --file <path>` without `--write`.
2. Review the proposed fixes and ambiguities.
3. Ask for confirmation if the repair changes meaning, question ordering, or status.
4. Run again with `--write` only after confirmation.

## Auto-refresh threshold

Once a state file exists, auto-refresh after a small batch of meaningful changes, such as:

- a resolved question
- a materially revised next question
- a new artifact update
- a status transition

Do not announce auto-refresh unless it changed the user's mental model.

## Compaction

Compaction is for older settled branches, not active uncertainty.

1. Suggest compaction only when the file is getting long or the resolved-question section is noisy.
2. Keep recent resolved questions in full detail.
3. Collapse older resolved questions into a summary block that still preserves each original `Q-XXX` id.
4. Validate after compaction.

## Pointer rules

- The pointer file contains only `path`, `status`, and `description`.
- Only resumable sessions belong in the pointer.
- If a session becomes `completed` or `abandoned`, clear the pointer values.
- If the pointer disagrees with the Markdown state file, trust the Markdown state file.
