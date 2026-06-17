---
name: cnp
description: Inspect changes, create one or more Conventional Commits, and push — use when the user says "commit and push", "cnp", or "commit everything and push"
metadata:
  version: 0.1.0
  author: jimzord12
  created_at: Jun 17, 2026
  updated_at: Jun 17, 2026
---

# cnp — Commit and Push

Survey the changes (`git status`, `git diff HEAD`), commit them following Conventional Commits, and push.

## The one thing to get right: don't over-split

**One commit is the default.** More files changed does not mean more commits. Split into multiple commits *only* when changes are independently meaningful and independently reversible — reverting one shouldn't break the other (e.g. a refactor and an unrelated feature that happened to land together).

Rule of thumb: if one "and" describes the work, it's one commit. If you need two "and"s, consider splitting. When in doubt, keep it as one.

When splitting, stage each group precisely with `git add <files>` — never `git add -A`. Commit foundational changes first.

## Guardrails

- Never force push or `--no-verify` unless the user explicitly asks.
- Warn (don't commit) if anything secret-looking is staged (`.env`, `*.key`, `*.pem`, credentials).
- Don't fold in unrelated cleanup or formatting that isn't already in the diff.
- Omit a scope rather than guess one.
- If push is rejected, don't force — `git pull --rebase` and retry, or report the conflict.

## Output

Report: how many commits and why, the message(s), and whether the push succeeded.
