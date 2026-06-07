---
name: verify-git-flow-setup
description: Verify that the git-flow-check and git-flow-add-restriction skills are installed correctly and that a repository is ready for solo-maintainer GitHub Flow. Use when asked to validate skill installation, script executability, gh authentication, branch protection visibility, required checks readiness, or end-to-end GitHub Flow setup.
---

# Verify Git Flow Setup

Use this skill to verify both the local skill installation and the repository-side prerequisites for a solo-maintainer GitHub Flow workflow. This skill is a validation and readiness checklist: it does not create branch protection by itself unless the operator explicitly asks to run one of the write-capable helper scripts.[web:27][web:155]

## What this skill verifies

This skill verifies five things:

1. The three skill folders exist in the expected locations.
2. Each `SKILL.md` file exists and appears structurally valid.
3. Each helper script exists and is executable.
4. The local environment is ready, especially `gh`, `jq`, and GitHub authentication.
5. The target repository is ready for GitHub Flow checks and restrictions, including branch visibility and required-check readiness.[web:25][web:32][web:151]

## When to use it

Use this skill when the task involves any of the following:

- Verifying that the skills were installed correctly.
- Checking whether helper scripts are executable.
- Confirming that `gh auth status` is healthy.
- Confirming that a repo can be audited with `git-flow-check`.
- Confirming that a repo is ready for `git-flow-add-restriction`.
- Running an end-to-end readiness check before enforcing branch restrictions.

Do not use this skill to define policy from scratch. Use it to validate setup and readiness.

## Inputs

This skill can work in two modes.

### Mode 1: Local-only verification

Use this when verifying only the local skills installation.

Optional inputs:

- Workspace root, if not obvious from the current directory.

### Mode 2: Local + repository verification

Use this when also verifying a real GitHub repo.

Required input:

- `OWNER/REPO`

Optional input:

- Explicit branch name, otherwise use the repo default branch.

## Expected directory layout

The expected skill layout is:

```text
.agents/
└── skills/
    ├── git-flow-check/
    │   ├── SKILL.md
    │   └── scripts/
    │       └── check-git-flow.sh
    ├── git-flow-add-restriction/
    │   ├── SKILL.md
    │   └── scripts/
    │       └── add-git-flow-restriction.sh
    └── verify-git-flow-setup/
        └── SKILL.md
```

If any required file is missing, report `FAIL`.

## Verification procedure

Follow these steps in order.

### Step 1: Verify the skill directories exist

Check for:

- `.agents/skills/git-flow-check/`
- `.agents/skills/git-flow-add-restriction/`
- `.agents/skills/verify-git-flow-setup/`

### Step 2: Verify required files exist

Check for:

- `.agents/skills/git-flow-check/SKILL.md`
- `.agents/skills/git-flow-check/scripts/check-git-flow.sh`
- `.agents/skills/git-flow-add-restriction/SKILL.md`
- `.agents/skills/git-flow-add-restriction/scripts/add-git-flow-restriction.sh`
- `.agents/skills/verify-git-flow-setup/SKILL.md`

### Step 3: Verify `SKILL.md` frontmatter basics

For each `SKILL.md`, verify:

- YAML frontmatter exists at the top.
- `name` exists.
- `description` exists.
- The `name` value matches the parent folder name.[web:28][web:39][web:124]

A full schema validator is not required, but obvious frontmatter breakage is a failure.

### Step 4: Verify script executability

For each script, verify:

- The file exists.
- It has a shebang.
- It is executable.
- It can be syntax-checked if appropriate.

Expected scripts:

- `check-git-flow.sh`
- `add-git-flow-restriction.sh`

### Step 5: Verify local tool prerequisites

Check these tools:

- `gh`
- `jq`
- `git`

Also check:

```bash
gh auth status
```

If GitHub authentication is missing or broken, repository-level checks cannot pass.[web:25]

### Step 6: Verify repository access, if repo input is provided

If a repository is provided:

1. Resolve the repo:
   ```bash
   gh repo view OWNER/REPO --json nameWithOwner,defaultBranchRef,url
   ```
2. Detect the default branch.
3. Confirm branch protection visibility is accessible:
   ```bash
   gh api repos/OWNER/REPO/branches/BRANCH/protection
   ```
4. Check whether rulesets can be queried:
   ```bash
   gh ruleset check --repo OWNER/REPO --default
   ```

If authentication or permissions block these checks, report `FAIL` or `PASS_WITH_WARNINGS` depending on whether the failure is local-only or permission-related.[web:25][web:19]

### Step 7: Verify required-check readiness

If the repo is meant to require CI checks, verify that those checks are likely selectable and usable. GitHub only allows required checks that have run recently in the repository, so a repo may not be ready to require checks even if workflows exist.[web:32][web:151][web:158]

Flag a warning if:

- No checks have run recently.
- The operator wants required checks but there is no known CI job name.
- Workflows only run on branches other than the protected branch.[web:147][web:151]

### Step 8: Optional smoke tests

If the operator allows command execution, run these smoke tests:

Read-only audit:

```bash
.agents/skills/git-flow-check/scripts/check-git-flow.sh OWNER/REPO
```

Write-path dry readiness review:

- Do not execute the write script automatically unless explicitly approved.
- Instead, confirm the command that would be run, for example:

```bash
.agents/skills/git-flow-add-restriction/scripts/add-git-flow-restriction.sh OWNER/REPO main ci true
```

## Status rules

Return one of these statuses:

- `PASS`
- `PASS_WITH_WARNINGS`
- `FAIL`

### PASS

Use `PASS` when:

- All required files exist.
- Frontmatter looks valid.
- Scripts are executable.
- Local tools are installed.
- GitHub authentication works.
- Repository inspection works, if a repo was provided.
- Required-check setup is either already valid or intentionally not configured yet.

### PASS_WITH_WARNINGS

Use this when:

- Local files are correct, but repo permissions are limited.
- Repo inspection works, but required checks are not ready to be enforced yet.[web:151]
- A script is present but not executable and can be fixed with `chmod +x`.
- The setup is functionally close, but not fully ready for safe enforcement.

### FAIL

Use this when:

- Any required file is missing.
- Any `SKILL.md` is obviously malformed.
- Required scripts are missing.
- `gh` or `jq` is missing.
- GitHub auth is unavailable for a repo-level verification.
- The repository cannot be inspected at all for the requested verification scope.

## Output format

Always return these sections in order.

### 1. Verdict

One line:

- `PASS`
- `PASS_WITH_WARNINGS`
- `FAIL`

### 2. Local installation checks

Use a checklist-style report for:

- Skill directories
- `SKILL.md` files
- Script files
- Executable bits
- Tool availability
- GitHub auth

### 3. Repository checks

If a repo was supplied, include:

- Repo
- Default branch
- Branch protection visibility
- Ruleset visibility
- Required-check readiness

If no repo was supplied, say `Not run`.

### 4. Findings

Only list exceptions, failures, warnings, or important observations.

### 5. Fixes

List the shortest path to a clean `PASS`.

## Guardrails

- Do not assume the repo is ready for required checks just because GitHub Actions exists.[web:32][web:151]
- Do not run the write script without explicit permission.
- Do not silently ignore missing execute permissions.
- Do not assume the default branch is `main`.
- Do not mark repository checks as passed if GitHub auth failed.
- Prefer concrete file and command checks over inference.[web:27]

## Suggested local commands

Use commands like these when helpful:

```bash
ls -R .agents/skills
test -f .agents/skills/git-flow-check/SKILL.md
test -x .agents/skills/git-flow-check/scripts/check-git-flow.sh
head -n 20 .agents/skills/git-flow-check/SKILL.md
gh auth status
gh repo view OWNER/REPO --json nameWithOwner,defaultBranchRef,url
gh ruleset check --repo OWNER/REPO --default
gh api repos/OWNER/REPO/branches/BRANCH/protection
```

## Scripts

Use the helper script when available:

```bash
bash scripts/verify-git-flow-setup.sh
```

If a repository should also be verified:

```bash
bash scripts/verify-git-flow-setup.sh OWNER/REPO
```

If a specific branch should be checked:

```bash
bash scripts/verify-git-flow-setup.sh OWNER/REPO main
```

## Example interpretation

If all three skills exist, both scripts are executable, `gh auth status` succeeds, the repository can be queried, and the audit script runs successfully, the setup should usually be reported as `PASS`. If required checks cannot yet be enforced because no recent CI checks exist, report `PASS_WITH_WARNINGS` and explain that a recent workflow run is needed before those checks can be selected as mandatory.[web:32][web:151][web:158]
