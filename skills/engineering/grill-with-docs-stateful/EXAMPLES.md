# Examples

## Save state after a long session

User request:

```text
Save this grilling session so I can continue it tomorrow.
```

Expected behavior:

1. Summarise the current resume brief.
2. Write `.scratch/grilling-sessions/XXX-...-state.md`.
3. Validate it.
4. Update `last-session.json` if the status is `active` or `paused`.

## Resume from the last active session

User request:

```text
Can we resume the last grilling session?
```

Expected behavior:

1. Read `last-session.json`.
2. Validate the pointed state file.
3. If it is paused, move it to `active` and rewrite immediately.
4. Resume from the `Resume Brief` and `Next Question` sections.

## Repair a malformed file

User request:

```text
This state file got edited manually and now load-state is confused. Recover it.
```

Expected behavior:

1. Run the repair helper without writing.
2. Show which sections or ids will be reconstructed.
3. Ask for confirmation if meaning could change.
4. Write the repaired file only after confirmation.

## Handle a stale-write conflict

User request:

```text
Save this session, but another chat may have touched the file.
```

Expected behavior:

1. Detect the hash mismatch.
2. Reload the latest state file.
3. Merge current progress into the latest copy.
4. Validate before writing.

## Compact older resolved questions

User request:

```text
This state file is getting too long. Compact the old resolved branches.
```

Expected behavior:

1. Ask for confirmation.
2. Keep newer resolved questions in full detail.
3. Convert older ones into a compact summary that still includes every `Q-XXX` id.
4. Validate the result after compaction.
