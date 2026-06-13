---
name: cnp
description: Commit and push. Inspects staged/unstaged changes, decides whether one commit or multiple are warranted, creates commits following Conventional Commits, and pushes. Use when the user says "commit and push", "cnp", or "commit everything and push".
---

# cnp — Commit and Push

Inspect the current changes, decide how many commits are appropriate, create them with Conventional Commits messages, and push.

## Core principle: one commit is the default

**Do not split unless the changes are genuinely independent.** The most common mistake is reflexively splitting changes into multiple commits just because many files changed. More files does not mean more commits.

A single commit is correct when:
- All changes serve the same purpose or fix the same thing.
- Files changed together as part of one cohesive task (e.g., added a feature and its tests).
- Refactoring and the associated type-fix live together because one caused the other.
- Changes to config, scripts, and docs all belong to the same release or setup task.

Split into multiple commits only when:
- Changes are **independently meaningful and independently reversible** — reverting one should not break the other.
- A bug fix and an unrelated new feature happened to land in the same working session.
- A refactor is logically separate from a behavior change that followed it.

> Rule of thumb: if you have to use "and" twice to describe a single commit, consider splitting. If one "and" covers it, keep it together.

## Procedure

### Step 1 — Survey the changes

Run these commands to understand the full scope:

```bash
git status
git diff HEAD
```

Note:
- Which files changed and in which directories.
- Whether changes are staged, unstaged, or untracked.
- The rough purpose of each changed file.

### Step 2 — Decide: one commit or multiple?

Apply the principle above. Think in terms of **logical units**, not file counts.

**Examples of one commit:**
- 12 files changed — all part of adding a new API endpoint and its tests → one `feat:` commit.
- 3 config files + 1 script + 1 doc → all part of the same infrastructure change → one `chore:` commit.
- A bug fix that required changing 5 files → one `fix:` commit.

**Examples where splitting is correct:**
- A refactor of an existing module (no behavior change) + a new feature built on top → `refactor:` first, then `feat:`.
- A dependency bump + a new feature that uses the new dependency → `chore:` then `feat:`.
- Two unrelated bug fixes found and fixed in the same session → two `fix:` commits.

If in doubt, **keep it as one commit**.

### Step 3 — Stage the changes

For a single commit, stage everything at once:

```bash
git add -A
```

For multiple commits, stage each logical group separately using `git add <specific-files>` before each commit. Never use `git add -A` when splitting — stage precisely.

### Step 4 — Write the commit message(s)

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <short description>

[optional body — only when the WHY is non-obvious]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | New capability visible to users or callers |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `chore` | Tooling, config, dependencies, CI, scripts |
| `docs` | Documentation only |
| `test` | Tests only |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |
| `build` | Build system or external dependency changes |
| `ci` | CI config and scripts |

Rules:
- Use imperative mood: "add auth middleware", not "added" or "adds".
- Keep the subject line under 72 characters.
- No period at the end of the subject line.
- Add a body only when the reason behind the change is not obvious from the code.
- Use `BREAKING CHANGE:` in the footer when the change breaks an existing API.

### Step 5 — Commit

```bash
git commit -m "<message>"
```

If there are multiple commits, create them in logical order (foundational changes first).

### Step 6 — Push

After all commits are created:

```bash
git push
```

If the branch has no upstream yet:

```bash
git push -u origin <branch-name>
```

If the push is rejected because the remote has commits the local branch does not:
- Do **not** force push without telling the user.
- Run `git pull --rebase` and push again, or report the conflict to the user.

## Output

After completing, report briefly:

- How many commits were created and why (one sentence on the split rationale, or "single commit — all changes serve one purpose").
- The commit message(s).
- Whether the push succeeded or if there is an issue to resolve.

## Guardrails

- Never force push (`--force`) unless the user explicitly requests it.
- Never skip hooks (`--no-verify`).
- Do not commit files that look like secrets (`.env`, `credentials.json`, `*.key`, `*.pem`). Warn the user if you see them staged.
- Do not add unrelated cleanup or formatting to the commits unless those changes are already present in the diff.
- Do not invent a scope if you are not sure what it is — omit it rather than guess.
